import { prisma } from '../src/lib/prisma';
import { config } from '../src/lib/config';
import { getSettings } from '../src/services/settings';
import {
  ensureRealtimeDevices,
  estimateDemandKw,
  estimateSolarKw,
} from '../src/services/realtimeIngest';

const BACKFILL_DAYS = Number(process.argv[2] ?? 30);
const STEP_MS = 30 * 60 * 1000;

interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  cloud_cover: number[];
  shortwave_radiation: number[];
}

async function fetchWeather(): Promise<HourlyWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(config.realtimeLatitude));
  url.searchParams.set('longitude', String(config.realtimeLongitude));
  url.searchParams.set('hourly', 'temperature_2m,cloud_cover,shortwave_radiation');
  url.searchParams.set('timezone', config.realtimeTimezone);
  url.searchParams.set('past_days', String(Math.min(92, BACKFILL_DAYS)));
  url.searchParams.set('forecast_days', '1');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  const body = (await response.json()) as { hourly: HourlyWeather };
  return body.hourly;
}

function interpolateHourly(weather: HourlyWeather, at: Date) {
  const times = weather.time.map((t) => new Date(t).getTime());
  const target = at.getTime();

  let i = times.findIndex((t) => t > target);
  if (i === -1) i = times.length - 1;
  if (i === 0) i = 1;

  const t0 = times[i - 1];
  const t1 = times[i];
  const fraction = t1 === t0 ? 0 : (target - t0) / (t1 - t0);

  const lerp = (arr: number[]) => arr[i - 1] + (arr[i] - arr[i - 1]) * fraction;

  return {
    temperatureC: lerp(weather.temperature_2m),
    cloudCoverPct: lerp(weather.cloud_cover),
    solarRadiationWm2: Math.max(0, lerp(weather.shortwave_radiation)),
  };
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function main() {
  console.log(`Backfilling ${BACKFILL_DAYS} days of real historical weather data...`);

  const { load, solar } = await ensureRealtimeDevices();
  const settings = await getSettings();

  const to = new Date();
  const from = new Date(to.getTime() - BACKFILL_DAYS * 86_400_000);

  const weather = await fetchWeather();

  const loadRows: { deviceId: string; timestamp: Date; kwh: number; cost: number }[] = [];
  const solarRows: { deviceId: string; timestamp: Date; kwh: number; cost: number }[] = [];

  for (let t = from.getTime(); t < to.getTime(); t += STEP_MS) {
    const at = new Date(t);
    const { temperatureC, cloudCoverPct, solarRadiationWm2 } = interpolateHourly(weather, at);

    const demandKw = estimateDemandKw(temperatureC, cloudCoverPct);
    const generationKw = estimateSolarKw(solarRadiationWm2);
    const hours = STEP_MS / 3_600_000;
    const demandKwh = demandKw * hours;
    const solarKwh = generationKw * hours;

    loadRows.push({
      deviceId: load.id,
      timestamp: at,
      kwh: round(demandKwh),
      cost: round(demandKwh * settings.tariffPerKwh),
    });
    solarRows.push({
      deviceId: solar.id,
      timestamp: at,
      kwh: round(-solarKwh),
      cost: round(-solarKwh * settings.tariffPerKwh),
    });
  }

  const result = await prisma.reading.createMany({
    data: [...loadRows, ...solarRows],
    skipDuplicates: true,
  });

  console.log(`Inserted ${result.count} real historical readings.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
