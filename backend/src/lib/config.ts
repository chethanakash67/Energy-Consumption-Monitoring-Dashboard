import dotenv from 'dotenv';

dotenv.config();

/** Minutes covered by a single stored Reading row. */
export const INTERVAL_MINUTES = 15;

/** Readings per hour, derived from the interval. */
export const INTERVALS_PER_HOUR = 60 / INTERVAL_MINUTES;

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'insecure-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  realtimeIngestEnabled: process.env.REALTIME_INGEST_ENABLED !== 'false',
  realtimeIngestPollMs: Number(process.env.REALTIME_INGEST_POLL_MS ?? 60_000),
  realtimeLatitude: Number(process.env.REALTIME_LATITUDE ?? 12.9716),
  realtimeLongitude: Number(process.env.REALTIME_LONGITUDE ?? 77.5946),
  realtimeTimezone: process.env.REALTIME_TIMEZONE ?? 'Asia/Kolkata',
  realtimeBaseLoadKw: Number(process.env.REALTIME_BASE_LOAD_KW ?? 8),
  realtimeSolarCapacityKw: Number(process.env.REALTIME_SOLAR_CAPACITY_KW ?? 5),
  realtimeDemandAlertKw: Number(process.env.REALTIME_DEMAND_ALERT_KW ?? 12),
  realtimeCarbonAlertGPerKwh: Number(process.env.REALTIME_CARBON_ALERT_G_PER_KWH ?? 300),
  simulatorEnabled: process.env.SIMULATOR_ENABLED === 'true',
  simulatorTickMs: Number(process.env.SIMULATOR_TICK_MS ?? 4000),
  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * Defaults for the global Setting table. Seeded on first run and editable by
 * admins from the Settings page.
 */
export const DEFAULT_SETTINGS = {
  /** Base electricity price per kWh (before time-of-use multipliers). */
  tariffPerKwh: '0.18',
  /** Grid carbon intensity in kg CO2e per kWh. */
  carbonKgPerKwh: '0.417',
  /** ISO-4217 currency code used for all money formatting. */
  currency: 'USD',
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
