/**
 * Seed script.
 *
 * Creates the demo tenant: 4 locations, 13 devices, two users, global settings,
 * 60 days of 15-minute readings, and the alert history implied by that data.
 *
 * Run with `npm run seed` (destructive — it truncates the domain tables first).
 */

import { AlertType, DeviceStatus, DeviceType, Prisma, Role, Severity } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { DEFAULT_SETTINGS, INTERVAL_MINUTES } from '../src/lib/config';
import {
  costForInterval,
  isProducer,
  kwToIntervalKwh,
  sampleDevice,
} from '../src/services/simulation';

const HISTORY_DAYS = 60;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const TARIFF = Number(DEFAULT_SETTINGS.tariffPerKwh);

/** Alerts are only retained for the recent window so the feed stays relevant. */
const ALERT_HISTORY_DAYS = 21;
/** Minimum gap between two alerts for the same device, avoids feed spam. */
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

interface DeviceSeed {
  name: string;
  type: DeviceType;
  ratedCapacityKw: number;
  status?: DeviceStatus;
  thresholdKwh?: number;
}

interface LocationSeed {
  name: string;
  address: string;
  devices: DeviceSeed[];
}

/**
 * The simulator derives its daily load shapes from server-local time, and the
 * frontend renders every timestamp in the viewer's local time. Anchoring the
 * seeded sites to that same zone keeps "8am on the chart" mean "8am in the
 * shift pattern" rather than silently shifting by the UTC offset.
 */
const SITE_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const LOCATIONS: LocationSeed[] = [
  {
    name: 'Downtown HQ',
    address: 'Building A, 410 Market Street',
    devices: [
      { name: 'Rooftop HVAC Unit', type: DeviceType.HVAC, ratedCapacityKw: 45, thresholdKwh: 9 },
      { name: 'Floor 3 Lighting Grid', type: DeviceType.LIGHTING, ratedCapacityKw: 12 },
      { name: 'Office Plug Load', type: DeviceType.APPLIANCE, ratedCapacityKw: 18 },
      {
        name: 'Garage EV Chargers',
        type: DeviceType.EV_CHARGER,
        ratedCapacityKw: 50,
        thresholdKwh: 11,
      },
    ],
  },
  {
    name: 'Riverside Plant',
    address: 'Unit 7, 2200 Industrial Way',
    devices: [
      {
        name: 'Assembly Line A',
        type: DeviceType.MACHINERY,
        ratedCapacityKw: 120,
        thresholdKwh: 28,
      },
      { name: 'Compressor Bank', type: DeviceType.MACHINERY, ratedCapacityKw: 75 },
      { name: 'Plant Air Handling', type: DeviceType.HVAC, ratedCapacityKw: 60 },
    ],
  },
  {
    name: 'Northgate Data Center',
    address: 'Hall 2, 88 Fiber Loop',
    devices: [
      { name: 'Rack Row 1-4', type: DeviceType.SERVER_ROOM, ratedCapacityKw: 90 },
      { name: 'CRAC Cooling Unit', type: DeviceType.HVAC, ratedCapacityKw: 55, thresholdKwh: 12 },
      {
        name: 'Backup Chiller',
        type: DeviceType.HVAC,
        ratedCapacityKw: 40,
        status: DeviceStatus.IDLE,
      },
    ],
  },
  {
    name: 'Lakeview Retail',
    address: 'Suite 140, 17 Lakeview Plaza',
    devices: [
      {
        name: 'Store Refrigeration',
        type: DeviceType.REFRIGERATION,
        ratedCapacityKw: 30,
        thresholdKwh: 6.5,
      },
      { name: 'Showroom Lighting', type: DeviceType.LIGHTING, ratedCapacityKw: 15 },
      { name: 'Rooftop Solar Array', type: DeviceType.SOLAR, ratedCapacityKw: 40 },
    ],
  },
];

/** Round to the previous interval boundary so buckets line up across devices. */
function floorToInterval(date: Date): Date {
  return new Date(Math.floor(date.getTime() / INTERVAL_MS) * INTERVAL_MS);
}

function severityFor(ratio: number): Severity {
  if (ratio >= 2) return Severity.CRITICAL;
  if (ratio >= 1.5) return Severity.WARNING;
  return Severity.INFO;
}

async function main() {
  console.log('Seeding Voltiq demo data...');

  // ---- Reset -------------------------------------------------------------
  // Order matters: children before parents (FKs are ON DELETE CASCADE, but an
  // explicit order keeps this readable and safe if the schema changes).
  await prisma.alert.deleteMany();
  await prisma.reading.deleteMany();
  await prisma.device.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  // ---- Settings ----------------------------------------------------------
  await prisma.setting.createMany({
    data: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })),
  });

  // ---- Users -------------------------------------------------------------
  const [adminHash, viewerHash] = await Promise.all([
    bcrypt.hash('admin1234', 10),
    bcrypt.hash('viewer1234', 10),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@voltiq.io',
      name: 'Avery Chen',
      passwordHash: adminHash,
      role: Role.ADMIN,
      notifyMinLevel: Severity.INFO,
    },
  });

  await prisma.user.create({
    data: {
      email: 'viewer@voltiq.io',
      name: 'Sam Rivera',
      passwordHash: viewerHash,
      role: Role.VIEWER,
    },
  });

  console.log('  users: admin@voltiq.io / admin1234, viewer@voltiq.io / viewer1234');

  // ---- Locations + devices -----------------------------------------------
  const installedAt = new Date(Date.now() - (HISTORY_DAYS + 30) * 24 * 60 * 60 * 1000);
  const devices: {
    id: string;
    name: string;
    type: DeviceType;
    ratedCapacityKw: number;
    status: DeviceStatus;
    thresholdKwh: number | null;
  }[] = [];

  for (const locationSeed of LOCATIONS) {
    const location = await prisma.location.create({
      data: {
        name: locationSeed.name,
        address: locationSeed.address,
        timezone: SITE_TIMEZONE,
      },
    });

    for (const deviceSeed of locationSeed.devices) {
      const device = await prisma.device.create({
        data: {
          name: deviceSeed.name,
          type: deviceSeed.type,
          ratedCapacityKw: deviceSeed.ratedCapacityKw,
          status: deviceSeed.status ?? DeviceStatus.ONLINE,
          thresholdKwh: deviceSeed.thresholdKwh ?? null,
          locationId: location.id,
          installedAt,
        },
      });
      devices.push({
        id: device.id,
        name: device.name,
        type: device.type,
        ratedCapacityKw: device.ratedCapacityKw,
        status: device.status,
        thresholdKwh: device.thresholdKwh,
      });
    }
  }

  console.log(`  ${LOCATIONS.length} locations, ${devices.length} devices`);

  // ---- Readings ----------------------------------------------------------
  const end = floorToInterval(new Date());
  const start = new Date(end.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const alertCutoff = new Date(end.getTime() - ALERT_HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const readings: Prisma.ReadingCreateManyInput[] = [];
  const alerts: Prisma.AlertCreateManyInput[] = [];
  const lastAlertAt = new Map<string, number>();
  let written = 0;

  const flush = async () => {
    if (readings.length === 0) return;
    await prisma.reading.createMany({ data: readings, skipDuplicates: true });
    written += readings.length;
    readings.length = 0;
    process.stdout.write(`\r  readings written: ${written}`);
  };

  for (const device of devices) {
    for (let t = start.getTime(); t < end.getTime(); t += INTERVAL_MS) {
      const at = new Date(t);
      const sample = sampleDevice(device, at);
      const kwh = Number(kwToIntervalKwh(sample.kw).toFixed(4));
      const cost = Number(costForInterval(kwh, at, TARIFF).toFixed(4));

      readings.push({ deviceId: device.id, timestamp: at, kwh, cost });

      // Derive the alert history from the same data the charts will show, so
      // every alert in the feed is verifiable by looking at the device chart.
      if (at >= alertCutoff) {
        const baselineKwh = kwToIntervalKwh(sample.baselineKw);
        const magnitude = Math.abs(kwh);
        const baselineMagnitude = Math.abs(baselineKwh);
        const ratio = baselineMagnitude > 0.05 ? magnitude / baselineMagnitude : 1;
        const cooledDown = t - (lastAlertAt.get(device.id) ?? 0) > ALERT_COOLDOWN_MS;

        if (cooledDown && device.thresholdKwh && magnitude > device.thresholdKwh) {
          lastAlertAt.set(device.id, t);
          alerts.push({
            deviceId: device.id,
            type: AlertType.THRESHOLD,
            severity: severityFor(magnitude / device.thresholdKwh),
            message: `${device.name} drew ${magnitude.toFixed(2)} kWh in a 15-minute interval, above its ${device.thresholdKwh} kWh threshold.`,
            value: kwh,
            baseline: device.thresholdKwh,
            timestamp: at,
            acknowledged: false,
          });
        } else if (cooledDown && sample.anomalous && ratio >= 1.4) {
          lastAlertAt.set(device.id, t);
          alerts.push({
            deviceId: device.id,
            type: AlertType.SPIKE,
            severity: severityFor(ratio),
            message: `${device.name} used ${Math.round((ratio - 1) * 100)}% more than its expected ${baselineMagnitude.toFixed(2)} kWh for this time of day.`,
            value: kwh,
            baseline: Number(baselineKwh.toFixed(3)),
            timestamp: at,
            acknowledged: false,
          });
        } else if (
          cooledDown &&
          isProducer(device.type) &&
          baselineMagnitude > 1 &&
          ratio < 0.5
        ) {
          lastAlertAt.set(device.id, t);
          alerts.push({
            deviceId: device.id,
            type: AlertType.EFFICIENCY,
            severity: Severity.WARNING,
            message: `${device.name} generated only ${magnitude.toFixed(2)} kWh against an expected ${baselineMagnitude.toFixed(2)} kWh — check for shading or an inverter fault.`,
            value: kwh,
            baseline: Number(baselineKwh.toFixed(3)),
            timestamp: at,
            acknowledged: false,
          });
        }
      }

      if (readings.length >= 5000) await flush();
    }
  }

  await flush();
  process.stdout.write('\n');

  // ---- Alerts ------------------------------------------------------------
  // Acknowledge everything older than three days so the UI shows both states.
  const ackThreshold = end.getTime() - 3 * 24 * 60 * 60 * 1000;
  for (const alert of alerts) {
    const at = (alert.timestamp as Date).getTime();
    if (at < ackThreshold && Math.random() < 0.8) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date(at + 30 * 60 * 1000);
      alert.acknowledgedById = admin.id;
    }
  }

  await prisma.alert.createMany({ data: alerts });

  console.log(`  alerts: ${alerts.length}`);
  console.log(
    `  window: ${start.toISOString().slice(0, 10)} -> ${end.toISOString().slice(0, 10)} (${HISTORY_DAYS} days @ ${INTERVAL_MINUTES}m)`,
  );
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
