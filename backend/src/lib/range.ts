import { Request } from 'express';
import { z } from 'zod';
import { RangeFilter } from '../services/analytics';
import { badRequest } from './errors';

/** Named presets the UI's range toggle sends. */
export const RANGE_PRESETS = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

const querySchema = z.object({
  range: z.enum(['24h', '7d', '30d', '90d', 'custom']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  tz: z.string().optional(),
  deviceIds: z.string().optional(),
  locationIds: z.string().optional(),
  granularity: z.enum(['interval', 'hour', 'day']).optional(),
});

function splitIds(value?: string): string[] | undefined {
  if (!value) return undefined;
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Builds a `RangeFilter` from query params.
 *
 * Accepts either a named preset (`?range=7d`) or an explicit ISO window
 * (`?from=...&to=...`). The client's IANA timezone comes in as `?tz=` so that
 * day/hour buckets land on the user's calendar boundaries.
 */
export function parseRange(req: Request): RangeFilter & { granularity?: 'interval' | 'hour' | 'day' } {
  const query = querySchema.parse(req.query);
  const timezone = query.tz && isValidTimezone(query.tz) ? query.tz : 'UTC';

  let from: Date;
  let to: Date;

  if (query.from || query.to) {
    to = query.to ? new Date(query.to) : new Date();
    from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 3_600_000);
  } else {
    const hours = RANGE_PRESETS[(query.range as RangePreset) ?? '7d'] ?? RANGE_PRESETS['7d'];
    to = new Date();
    from = new Date(to.getTime() - hours * 3_600_000);
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw badRequest('Invalid date range');
  }
  if (from >= to) {
    throw badRequest('`from` must be earlier than `to`');
  }
  // Guard against a request that would scan years of readings.
  if (to.getTime() - from.getTime() > 400 * 24 * 3_600_000) {
    throw badRequest('Date range cannot exceed 400 days');
  }

  return {
    from,
    to,
    timezone,
    deviceIds: splitIds(query.deviceIds),
    locationIds: splitIds(query.locationIds),
    granularity: query.granularity,
  };
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
