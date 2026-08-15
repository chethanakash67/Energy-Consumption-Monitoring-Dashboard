import { AlertType, Device, Severity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { INTERVAL_MINUTES, config } from '../lib/config';
import { broadcast, heartbeat } from '../realtime/hub';
import { getSettings } from './settings';
import { costForInterval, kwToIntervalKwh, sampleDevice } from './simulation';

/**
 * Live data worker.
 *
 * Two cadences run here:
 *
 *  - **Tick** (every few seconds): sample instantaneous demand per device and
 *    push it to connected clients. Nothing is persisted — this only drives the
 *    "live usage" widget, which shows kW, not kWh.
 *
 *  - **Flush** (every 15 minutes, on the interval boundary): integrate the
 *    ticks into a stored `Reading` per device, then run anomaly detection on
 *    the result. This is what keeps the historical charts growing.
 *
 * On boot the worker also backfills any intervals missed while the process was
 * down, so restarting the server never leaves a gap in the trend chart.
 */

const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
/** Don't backfill more than this on boot — protects against a long downtime. */
const MAX_BACKFILL_INTERVALS = 4 * 24 * 4; // 4 days

/** Per-device accumulator between flushes: energy integrated from live ticks. */
interface Accumulator {
  kwh: number;
  /** Baseline energy over the same span, used as the anomaly reference. */
  baselineKwh: number;
  lastSampleAt: number;
}

const accumulators = new Map<string, Accumulator>();
let devices: Device[] = [];
let tickTimer: NodeJS.Timeout | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

function floorToInterval(ms: number): number {
  return Math.floor(ms / INTERVAL_MS) * INTERVAL_MS;
}

async function loadDevices() {
  devices = await prisma.device.findMany({ orderBy: { name: 'asc' } });
}

// ---------------------------------------------------------------------------
// Live tick
// ---------------------------------------------------------------------------

async function tick() {
  if (devices.length === 0) return;

  const now = new Date();
  const settings = await getSettings();
  const samples = [];
  let demandKw = 0;
  let generationKw = 0;

  for (const device of devices) {
    const sample = sampleDevice(device, now, { allowAnomaly: true });
    samples.push({ deviceId: device.id, name: device.name, kw: round(sample.kw, 3) });

    if (sample.kw >= 0) demandKw += sample.kw;
    else generationKw += -sample.kw;

    // Integrate this tick into the pending interval using the real elapsed
    // time since the previous tick, so a slow event loop doesn't under-count.
    const accumulator = accumulators.get(device.id) ?? {
      kwh: 0,
      baselineKwh: 0,
      lastSampleAt: now.getTime() - config.simulatorTickMs,
    };
    const elapsedHours = Math.min(
      (now.getTime() - accumulator.lastSampleAt) / 3_600_000,
      INTERVAL_MINUTES / 60,
    );
    accumulator.kwh += sample.kw * elapsedHours;
    accumulator.baselineKwh += sample.baselineKw * elapsedHours;
    accumulator.lastSampleAt = now.getTime();
    accumulators.set(device.id, accumulator);
  }

  const totalKw = demandKw - generationKw;

  broadcast({
    type: 'live',
    payload: {
      timestamp: now.toISOString(),
      totalKw: round(totalKw, 2),
      demandKw: round(demandKw, 2),
      generationKw: round(generationKw, 2),
      costPerHour: round(totalKw * settings.tariffPerKwh, 2),
      devices: samples,
    },
  });
}

// ---------------------------------------------------------------------------
// Interval flush + anomaly detection
// ---------------------------------------------------------------------------

/**
 * Writes one Reading per device for the interval starting at `intervalStart`.
 *
 * When `useAccumulators` is true the energy comes from integrated live ticks
 * (the normal path); otherwise it is sampled directly from the model, which is
 * how backfill works.
 */
async function flushInterval(intervalStart: Date, useAccumulators: boolean) {
  if (devices.length === 0) return;
  const settings = await getSettings();

  const rows = devices.map((device) => {
    let kwh: number;
    let baselineKwh: number;

    const accumulator = useAccumulators ? accumulators.get(device.id) : undefined;
    if (accumulator && Math.abs(accumulator.kwh) > 0) {
      kwh = accumulator.kwh;
      baselineKwh = accumulator.baselineKwh;
    } else {
      // Sample the midpoint of the interval as a representative value.
      const midpoint = new Date(intervalStart.getTime() + INTERVAL_MS / 2);
      const sample = sampleDevice(device, midpoint);
      kwh = kwToIntervalKwh(sample.kw);
      baselineKwh = kwToIntervalKwh(sample.baselineKw);
    }

    return {
      device,
      kwh: round(kwh, 4),
      baselineKwh: round(baselineKwh, 4),
      cost: round(costForInterval(kwh, intervalStart, settings.tariffPerKwh), 4),
    };
  });

  await prisma.reading.createMany({
    data: rows.map((row) => ({
      deviceId: row.device.id,
      timestamp: intervalStart,
      kwh: row.kwh,
      cost: row.cost,
    })),
    skipDuplicates: true,
  });

  accumulators.clear();
  broadcast({ type: 'reading', payload: { timestamp: intervalStart.toISOString() } });

  // Only evaluate alerts for intervals close to now. Backfilled history should
  // not spam the feed with stale alerts the user can no longer act on.
  const isRecent = Date.now() - intervalStart.getTime() < 2 * INTERVAL_MS;
  if (isRecent) {
    for (const row of rows) {
      await evaluateAlerts(row.device, row.kwh, row.baselineKwh, intervalStart);
    }
  }
}

function severityFor(ratio: number): Severity {
  if (ratio >= 2) return Severity.CRITICAL;
  if (ratio >= 1.5) return Severity.WARNING;
  return Severity.INFO;
}

/** Suppress repeat alerts for the same device inside this window. */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

async function evaluateAlerts(
  device: Device,
  kwh: number,
  baselineKwh: number,
  at: Date,
) {
  const magnitude = Math.abs(kwh);
  const baselineMagnitude = Math.abs(baselineKwh);

  const recent = await prisma.alert.findFirst({
    where: { deviceId: device.id, timestamp: { gte: new Date(at.getTime() - ALERT_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return;

  let created = null;

  if (device.thresholdKwh && magnitude > device.thresholdKwh) {
    created = await prisma.alert.create({
      data: {
        deviceId: device.id,
        type: AlertType.THRESHOLD,
        severity: severityFor(magnitude / device.thresholdKwh),
        message: `${device.name} drew ${magnitude.toFixed(2)} kWh in a 15-minute interval, above its ${device.thresholdKwh} kWh threshold.`,
        value: kwh,
        baseline: device.thresholdKwh,
        timestamp: at,
      },
      include: { device: { include: { location: true } } },
    });
  } else if (baselineMagnitude > 0.05 && magnitude / baselineMagnitude >= 1.4) {
    const ratio = magnitude / baselineMagnitude;
    created = await prisma.alert.create({
      data: {
        deviceId: device.id,
        type: AlertType.SPIKE,
        severity: severityFor(ratio),
        message: `${device.name} used ${Math.round((ratio - 1) * 100)}% more than its expected ${baselineMagnitude.toFixed(2)} kWh for this time of day.`,
        value: kwh,
        baseline: round(baselineKwh, 3),
        timestamp: at,
      },
      include: { device: { include: { location: true } } },
    });
  }

  if (created) {
    broadcast({ type: 'alert', payload: created });
  }
}

/** Fills in every interval between the newest stored reading and now. */
async function backfill() {
  const newest = await prisma.reading.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  if (!newest) return;

  const currentIntervalStart = floorToInterval(Date.now());
  let cursor = floorToInterval(newest.timestamp.getTime()) + INTERVAL_MS;

  const missing = Math.max(0, (currentIntervalStart - cursor) / INTERVAL_MS);
  if (missing === 0) return;

  if (missing > MAX_BACKFILL_INTERVALS) {
    cursor = currentIntervalStart - MAX_BACKFILL_INTERVALS * INTERVAL_MS;
    console.warn(
      `[simulator] ${missing} intervals missing; backfilling the most recent ${MAX_BACKFILL_INTERVALS} only.`,
    );
  }

  let filled = 0;
  for (; cursor < currentIntervalStart; cursor += INTERVAL_MS) {
    await flushInterval(new Date(cursor), false);
    filled += 1;
  }
  console.log(`[simulator] backfilled ${filled} interval(s)`);
}

/** Schedules the next flush exactly on the upcoming interval boundary. */
function scheduleFlush() {
  const nextBoundary = floorToInterval(Date.now()) + INTERVAL_MS;
  const delay = Math.max(1000, nextBoundary - Date.now());

  flushTimer = setTimeout(async () => {
    try {
      // The interval that just *closed* is the one before the boundary.
      await flushInterval(new Date(nextBoundary - INTERVAL_MS), true);
    } catch (error) {
      console.error('[simulator] flush failed:', error);
    } finally {
      scheduleFlush();
    }
  }, delay);
}

export async function startSimulator() {
  if (!config.simulatorEnabled) {
    console.log('[simulator] disabled via SIMULATOR_ENABLED=false');
    return;
  }

  await loadDevices();
  if (devices.length === 0) {
    console.warn('[simulator] no devices found — run `npm run seed` first.');
    return;
  }

  await backfill();

  tickTimer = setInterval(() => {
    tick().catch((error) => console.error('[simulator] tick failed:', error));
  }, config.simulatorTickMs);

  // Refresh the device list periodically so CRUD changes are picked up without
  // needing a restart.
  setInterval(() => {
    loadDevices().catch((error) => console.error('[simulator] device reload failed:', error));
  }, 30_000);

  heartbeatTimer = setInterval(heartbeat, 25_000);
  scheduleFlush();

  console.log(
    `[simulator] running — ${devices.length} devices, tick ${config.simulatorTickMs}ms, flush ${INTERVAL_MINUTES}m`,
  );
}

export function stopSimulator() {
  if (tickTimer) clearInterval(tickTimer);
  if (flushTimer) clearTimeout(flushTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
