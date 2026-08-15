import { prisma } from '../lib/prisma';
import { DEFAULT_SETTINGS, SettingKey } from '../lib/config';

export interface AppSettings {
  tariffPerKwh: number;
  carbonKgPerKwh: number;
  currency: string;
}

/**
 * Settings change rarely but are read on nearly every aggregation request, so
 * they are cached in-process with a short TTL.
 */
let cache: { value: AppSettings; expiresAt: number } | null = null;
const TTL_MS = 30_000;

export async function getSettings(): Promise<AppSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: SettingKey) => map.get(key) ?? DEFAULT_SETTINGS[key];

  const value: AppSettings = {
    tariffPerKwh: Number(read('tariffPerKwh')),
    carbonKgPerKwh: Number(read('carbonKgPerKwh')),
    currency: read('currency'),
  };

  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function updateSettings(patch: Partial<Record<SettingKey, string>>) {
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      }),
    ),
  );
  cache = null;
  return getSettings();
}

/** Drop the cache — used by tests and after a seed. */
export function invalidateSettingsCache() {
  cache = null;
}
