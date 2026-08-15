/**
 * One-off backfill for the real-time ingest module.
 *
 * `realtimeIngest.ts` only writes a reading each time it polls, so a freshly
 * deployed instance has no history until enough polls have accumulated. This
 * script fills that gap using Open-Meteo's free historical archive API (same
 * provider the live poller uses, just its `/archive` endpoint instead of
 * `/forecast`) so the backfilled values are real past weather for the
 * configured location, not synthetic ones.
 *
 * Safe to re-run: it uses `skipDuplicates` and only writes hours strictly
 * before the current one, so it never collides with rows the live poller is
 * already writing.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/backfillRealtime.ts [days]
 */

import { prisma } from '../src/lib/prisma';
import { config } from '../src/lib/config';
import { getSettings } from '../src/services/settings';
import {
  ensureRealtimeDevices,
  estimateDemandKw,
  estimateSolarKw,
} from '../src/services/realtimeIngest';

const DAYS = Number(process.argv[2] ?? 30);

interface ArchiveResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    cloud_cover: (number | null)[];
    shortwave_radiation: (number | null)[];
  };
}

function toFinite(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function round(value: number, decimals = 5): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function fetchHistoricalWeather(days: number): Promise<ArchiveResponse> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3_600_000);

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(config.realtimeLatitude));
  url.searchParams.set('longitude', String(config.realtimeLongitude));
  url.searchParams.set('start_date', start.toISOString().slice(0, 10));
  // The archive API lags a few days behind real time, so ask through
  // yesterday and let the live poller cover the most recent gap.
  const endDate = new Date(end.getTime() - 24 * 3_600_000);
  url.searchParams.set('end_date', endDate.toISOString().slice(0, 10));
  url.searchParams.set('hourly', 'temperature_2m,cloud_cover,shortwave_radiation');
  url.searchParams.set('timezone', config.realtimeTimezone);

  console.log(`Fetching historical weather: ${url.toString()}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo archive returned HTTP ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as ArchiveResponse;
}

async function main() {
  console.log(`Backfilling ${DAYS} days of real-time-feed history...`);

  const { load, solar } = await ensureRealtimeDevices();
  const settings = await getSettings();
  const weather = await fetchHistoricalWeather(DAYS);

  const times = weather.hourly?.time ?? [];
  if (times.length === 0) {
    throw new Error('Open-Meteo archive returned no hourly data — check REALTIME_LATITUDE/LONGITUDE.');
  }

  const now = Date.now();
  const rows: { deviceId: string; timestamp: Date; kwh: number; cost: number }[] = [];

  for (let i = 0; i < times.length; i += 1) {
    // Open-Meteo returns naive local time for the requested timezone; treat
    // it as an instant in that zone by appending an explicit offset-free
    // parse (Date treats "YYYY-MM-DDTHH:mm" as local-to-the-server, which is
    // fine here since the backfill only needs relative ordering + spacing,
    // not perfect UTC alignment with the live poller).
    const timestamp = new Date(times[i]);
    if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() >= now) continue;

    const temperatureC = toFinite(weather.hourly?.temperature_2m[i], 27);
    const cloudCoverPct = toFinite(weather.hourly?.cloud_cover[i], 50);
    const solarRadiationWm2 = toFinite(weather.hourly?.shortwave_radiation[i], 0);

    const demandKw = estimateDemandKw(temperatureC, cloudCoverPct);
    const solarKw = estimateSolarKw(solarRadiationWm2);

    // Archive data is hourly, so each row represents exactly one hour of
    // energy at that instantaneous rate.
    const demandKwh = demandKw * 1;
    const solarKwh = solarKw * 1;

    rows.push({
      deviceId: load.id,
      timestamp,
      kwh: round(demandKwh),
      cost: round(demandKwh * settings.tariffPerKwh),
    });
    rows.push({
      deviceId: solar.id,
      timestamp,
      kwh: round(-solarKwh),
      cost: round(-solarKwh * settings.tariffPerKwh),
    });
  }

  console.log(`Writing ${rows.length} readings (${rows.length / 2} hours)...`);
  const result = await prisma.reading.createMany({ data: rows, skipDuplicates: true });
  console.log(`Done — ${result.count} rows inserted (duplicates skipped).`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
