import { AlertType, Device, DeviceStatus, DeviceType, Severity } from '@prisma/client';
import { config } from '../lib/config';
import { prisma } from '../lib/prisma';
import { broadcast, heartbeat } from '../realtime/hub';
import { getSettings, updateSettings } from './settings';

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    cloud_cover?: number;
    shortwave_radiation?: number;
  };
}

interface CarbonIntensityResponse {
  data?: {
    from: string;
    to: string;
    intensity?: {
      forecast?: number;
      actual?: number | null;
      index?: string;
    };
  }[];
}

interface RealtimeDevices {
  load: Device;
  solar: Device;
}

interface IngestSnapshot {
  timestamp: string;
  source: 'open-meteo+carbon-intensity';
  latitude: number;
  longitude: number;
  temperatureC: number;
  cloudCoverPct: number;
  solarRadiationWm2: number;
  demandKw: number;
  generationKw: number;
  netKw: number;
  costPerHour: number;
  carbonGPerKwh: number | null;
  carbonIndex: string | null;
}

export const SOURCE_LOCATION_NAME = 'Realtime External Feeds';
const LOAD_DEVICE_NAME = 'Estimated Building Load';
const SOLAR_DEVICE_NAME = 'Estimated Solar Generation';
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

let pollTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let running = false;
let lastSnapshot: IngestSnapshot | null = null;
let lastError: string | null = null;
let lastPullAt: string | null = null;

export async function ensureRealtimeDevices(): Promise<RealtimeDevices> {
  const location = await prisma.location.upsert({
    where: { name: SOURCE_LOCATION_NAME },
    create: {
      name: SOURCE_LOCATION_NAME,
      address: 'No-key public realtime APIs: Open-Meteo and UK Carbon Intensity',
      timezone: config.realtimeTimezone,
    },
    update: {
      timezone: config.realtimeTimezone,
    },
  });

  const thresholdKwh =
    config.realtimeDemandAlertKw * (config.realtimeIngestPollMs / 3_600_000);

  const [load, solar] = await Promise.all([
    prisma.device.upsert({
      where: {
        locationId_name: {
          locationId: location.id,
          name: LOAD_DEVICE_NAME,
        },
      },
      create: {
        name: LOAD_DEVICE_NAME,
        type: DeviceType.APPLIANCE,
        status: DeviceStatus.ONLINE,
        ratedCapacityKw: Math.max(config.realtimeDemandAlertKw, config.realtimeBaseLoadKw),
        thresholdKwh,
        locationId: location.id,
      },
      update: {
        status: DeviceStatus.ONLINE,
        ratedCapacityKw: Math.max(config.realtimeDemandAlertKw, config.realtimeBaseLoadKw),
        thresholdKwh,
      },
    }),
    prisma.device.upsert({
      where: {
        locationId_name: {
          locationId: location.id,
          name: SOLAR_DEVICE_NAME,
        },
      },
      create: {
        name: SOLAR_DEVICE_NAME,
        type: DeviceType.SOLAR,
        status: DeviceStatus.ONLINE,
        ratedCapacityKw: config.realtimeSolarCapacityKw,
        locationId: location.id,
      },
      update: {
        status: DeviceStatus.ONLINE,
        ratedCapacityKw: config.realtimeSolarCapacityKw,
      },
    }),
  ]);

  return { load, solar };
}

export async function getRealtimeLocationId(): Promise<string> {
  const existing = await prisma.location.findUnique({
    where: { name: SOURCE_LOCATION_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const { load } = await ensureRealtimeDevices();
  return load.locationId;
}

async function fetchOpenMeteo(): Promise<OpenMeteoResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(config.realtimeLatitude));
  url.searchParams.set('longitude', String(config.realtimeLongitude));
  url.searchParams.set(
    'current',
    'temperature_2m,cloud_cover,shortwave_radiation',
  );
  url.searchParams.set('timezone', config.realtimeTimezone);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  return (await response.json()) as OpenMeteoResponse;
}

async function fetchCarbonIntensity(): Promise<CarbonIntensityResponse> {
  const response = await fetch('https://api.carbonintensity.org.uk/intensity');
  if (!response.ok) {
    throw new Error(`Carbon Intensity returned HTTP ${response.status}`);
  }
  return (await response.json()) as CarbonIntensityResponse;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function estimateDemandKw(temperatureC: number, cloudCoverPct: number): number {
  const coolingKw = Math.max(0, temperatureC - 24) * 0.38;
  const lightingKw = Math.max(0, Math.min(100, cloudCoverPct)) * 0.018;
  return Math.max(0, config.realtimeBaseLoadKw + coolingKw + lightingKw);
}

export function estimateSolarKw(solarRadiationWm2: number): number {
  const irradianceRatio = Math.max(0, Math.min(1, solarRadiationWm2 / 1000));
  return config.realtimeSolarCapacityKw * irradianceRatio;
}

async function createAlertIfCooledDown(
  deviceId: string,
  type: AlertType,
  severity: Severity,
  message: string,
  value: number,
  baseline: number,
) {
  const recent = await prisma.alert.findFirst({
    where: {
      deviceId,
      type,
      timestamp: { gte: new Date(Date.now() - ALERT_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) return;

  const alert = await prisma.alert.create({
    data: {
      deviceId,
      type,
      severity,
      message,
      value,
      baseline,
      timestamp: new Date(),
    },
    include: { device: { include: { location: true } } },
  });

  broadcast({ type: 'alert', payload: alert });
}

async function evaluateRealtimeAlerts(
  devices: RealtimeDevices,
  snapshot: IngestSnapshot,
) {
  if (snapshot.demandKw > config.realtimeDemandAlertKw) {
    await createAlertIfCooledDown(
      devices.load.id,
      AlertType.THRESHOLD,
      snapshot.demandKw >= config.realtimeDemandAlertKw * 1.5
        ? Severity.CRITICAL
        : Severity.WARNING,
      `Realtime estimated demand is ${snapshot.demandKw.toFixed(2)} kW, above the ${config.realtimeDemandAlertKw.toFixed(2)} kW limit.`,
      snapshot.demandKw,
      config.realtimeDemandAlertKw,
    );
  }

  if (
    snapshot.carbonGPerKwh !== null &&
    snapshot.carbonGPerKwh > config.realtimeCarbonAlertGPerKwh
  ) {
    await createAlertIfCooledDown(
      devices.load.id,
      AlertType.EFFICIENCY,
      snapshot.carbonGPerKwh >= config.realtimeCarbonAlertGPerKwh * 1.5
        ? Severity.CRITICAL
        : Severity.WARNING,
      `Realtime grid carbon intensity is ${Math.round(snapshot.carbonGPerKwh)} gCO2/kWh. Shift flexible loads if possible.`,
      snapshot.carbonGPerKwh,
      config.realtimeCarbonAlertGPerKwh,
    );
  }
}

export async function ingestRealtimeData(): Promise<IngestSnapshot> {
  const devices = await ensureRealtimeDevices();
  const settings = await getSettings();

  const [meteoResult, carbonResult] = await Promise.allSettled([
    fetchOpenMeteo(),
    fetchCarbonIntensity(),
  ]);

  if (meteoResult.status === 'rejected') throw meteoResult.reason;

  const current = meteoResult.value.current ?? {};
  const temperatureC = toFiniteNumber(current.temperature_2m, 27);
  const cloudCoverPct = toFiniteNumber(current.cloud_cover, 50);
  const solarRadiationWm2 = toFiniteNumber(current.shortwave_radiation, 0);

  let carbonGPerKwh: number | null = null;
  let carbonIndex: string | null = null;
  if (carbonResult.status === 'fulfilled') {
    const intensity = carbonResult.value.data?.[0]?.intensity;
    carbonGPerKwh = intensity?.actual ?? intensity?.forecast ?? null;
    carbonIndex = intensity?.index ?? null;
    if (carbonGPerKwh !== null) {
      await updateSettings({ carbonKgPerKwh: String(carbonGPerKwh / 1000) });
    }
  } else {
    console.warn('[realtime] carbon API failed:', carbonResult.reason);
  }

  const demandKw = estimateDemandKw(temperatureC, cloudCoverPct);
  const generationKw = estimateSolarKw(solarRadiationWm2);
  const netKw = demandKw - generationKw;
  const hours = config.realtimeIngestPollMs / 3_600_000;
  const demandKwh = demandKw * hours;
  const solarKwh = generationKw * hours;
  const timestamp = new Date();

  await prisma.reading.createMany({
    data: [
      {
        deviceId: devices.load.id,
        timestamp,
        kwh: round(demandKwh, 5),
        cost: round(demandKwh * settings.tariffPerKwh, 5),
      },
      {
        deviceId: devices.solar.id,
        timestamp,
        kwh: round(-solarKwh, 5),
        cost: round(-solarKwh * settings.tariffPerKwh, 5),
      },
    ],
    skipDuplicates: true,
  });

  const snapshot: IngestSnapshot = {
    timestamp: timestamp.toISOString(),
    source: 'open-meteo+carbon-intensity',
    latitude: config.realtimeLatitude,
    longitude: config.realtimeLongitude,
    temperatureC: round(temperatureC, 1),
    cloudCoverPct: round(cloudCoverPct, 1),
    solarRadiationWm2: round(solarRadiationWm2, 1),
    demandKw: round(demandKw, 3),
    generationKw: round(generationKw, 3),
    netKw: round(netKw, 3),
    costPerHour: round(Math.max(0, netKw) * settings.tariffPerKwh, 3),
    carbonGPerKwh,
    carbonIndex,
  };

  lastSnapshot = snapshot;
  lastPullAt = snapshot.timestamp;
  lastError = null;

  broadcast({
    type: 'live',
    payload: {
      timestamp: snapshot.timestamp,
      totalKw: snapshot.netKw,
      demandKw: snapshot.demandKw,
      generationKw: snapshot.generationKw,
      costPerHour: snapshot.costPerHour,
      devices: [
        { deviceId: devices.load.id, name: devices.load.name, kw: snapshot.demandKw },
        { deviceId: devices.solar.id, name: devices.solar.name, kw: -snapshot.generationKw },
      ],
    },
  });
  broadcast({ type: 'reading', payload: { timestamp: snapshot.timestamp } });

  await evaluateRealtimeAlerts(devices, snapshot);
  return snapshot;
}

export async function startRealtimeIngest() {
  if (!config.realtimeIngestEnabled) {
    console.log('[realtime] disabled via REALTIME_INGEST_ENABLED=false');
    return;
  }
  if (running) return;

  running = true;
  await ensureRealtimeDevices();

  ingestRealtimeData().catch((error) => {
    lastError = error instanceof Error ? error.message : String(error);
    console.error('[realtime] initial pull failed:', error);
  });

  pollTimer = setInterval(() => {
    ingestRealtimeData().catch((error) => {
      lastError = error instanceof Error ? error.message : String(error);
      console.error('[realtime] pull failed:', error);
    });
  }, config.realtimeIngestPollMs);

  heartbeatTimer = setInterval(heartbeat, 25_000);

  console.log(
    `[realtime] running — Open-Meteo + Carbon Intensity, poll ${config.realtimeIngestPollMs}ms`,
  );
}

export function stopRealtimeIngest() {
  if (pollTimer) clearInterval(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  pollTimer = null;
  heartbeatTimer = null;
  running = false;
}

export function getRealtimeStatus() {
  return {
    enabled: config.realtimeIngestEnabled,
    running,
    pollMs: config.realtimeIngestPollMs,
    lastPullAt,
    lastError,
    latest: lastSnapshot,
    sources: realtimeSources(),
  };
}

export function realtimeSources() {
  return [
    {
      name: 'Open-Meteo Forecast API',
      url: 'https://api.open-meteo.com/v1/forecast',
      apiKeyRequired: false,
      usedFor: ['temperature', 'cloud cover', 'solar radiation', 'estimated demand', 'estimated solar generation'],
    },
    {
      name: 'UK Carbon Intensity API',
      url: 'https://api.carbonintensity.org.uk/intensity',
      apiKeyRequired: false,
      usedFor: ['grid carbon intensity', 'carbon alerts', 'carbon KPI setting'],
    },
  ];
}

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
