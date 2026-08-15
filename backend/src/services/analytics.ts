import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getSettings } from './settings';

/**
 * Aggregation layer.
 *
 * Every chart in the product is backed by one of these functions. They use raw
 * SQL rather than Prisma's groupBy because we need time-bucketing
 * (`date_trunc`) and timezone-aware grouping, which the query builder does not
 * express.
 *
 * ## A note on time zones
 *
 * Prisma stores `DateTime` as `timestamp(3)` *without* time zone, holding the
 * UTC instant. Bucketing that directly would split "days" at the UTC midnight,
 * which is the wrong boundary for anyone not on UTC. So every bucket
 * expression re-interprets the column as UTC and converts it into the caller's
 * zone before truncating, then converts back to an absolute instant for the
 * JSON response:
 *
 *   date_trunc('day', ts AT TIME ZONE 'UTC' AT TIME ZONE $tz) AT TIME ZONE $tz
 *   \_______________ naive local time ________________/  \__ back to instant _/
 */

export type Granularity = 'interval' | 'hour' | 'day';

export interface RangeFilter {
  from: Date;
  to: Date;
  timezone: string;
  deviceIds?: string[];
  locationIds?: string[];
}

/** Seconds in one stored reading interval, used for epoch-floor bucketing. */
const INTERVAL_SECONDS = 15 * 60;

/** Picks a sensible bucket size so a chart never renders thousands of points. */
export function autoGranularity(from: Date, to: Date): Granularity {
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  if (hours <= 49) return 'interval'; // up to ~2 days -> 15-minute detail
  if (hours <= 24 * 15) return 'hour'; // up to ~2 weeks -> hourly
  return 'day';
}

/**
 * SQL expression producing the bucket timestamp for a granularity.
 *
 * 15-minute buckets are floored on the raw epoch: every IANA offset is a
 * multiple of 15 minutes, so those buckets align identically in any zone and
 * skipping the conversion keeps the expression index-friendly.
 */
function bucketExpr(granularity: Granularity, timezone: string): Prisma.Sql {
  if (granularity === 'interval') {
    return Prisma.sql`to_timestamp(floor(extract(epoch from r."timestamp") / ${INTERVAL_SECONDS}) * ${INTERVAL_SECONDS})`;
  }
  const unit = granularity === 'hour' ? 'hour' : 'day';
  return Prisma.sql`date_trunc(${unit}, r."timestamp" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}`;
}

/** Shared WHERE fragment for range + optional device/location scoping. */
function whereClause(filter: RangeFilter): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`r."timestamp" >= ${filter.from} AND r."timestamp" < ${filter.to}`,
  ];

  if (filter.deviceIds?.length) {
    parts.push(Prisma.sql`r."deviceId" IN (${Prisma.join(filter.deviceIds)})`);
  }
  if (filter.locationIds?.length) {
    parts.push(Prisma.sql`d."locationId" IN (${Prisma.join(filter.locationIds)})`);
  }

  return Prisma.join(parts, ' AND ');
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  timestamp: string;
  kwh: number;
  cost: number;
  /** Grid draw only — excludes solar generation. */
  consumptionKwh: number;
  /** Solar output as a positive number, for stacked/area comparisons. */
  generationKwh: number;
}

export async function getSeries(
  filter: RangeFilter,
  granularity: Granularity = autoGranularity(filter.from, filter.to),
): Promise<{ granularity: Granularity; points: SeriesPoint[] }> {
  const rows = await prisma.$queryRaw<
    { bucket: Date; kwh: number; cost: number; consumption: number; generation: number }[]
  >(Prisma.sql`
    SELECT
      ${bucketExpr(granularity, filter.timezone)} AS bucket,
      SUM(r."kwh")::float8                                   AS kwh,
      SUM(r."cost")::float8                                  AS cost,
      SUM(GREATEST(r."kwh", 0))::float8                      AS consumption,
      SUM(GREATEST(-r."kwh", 0))::float8                     AS generation
    FROM "Reading" r
    JOIN "Device" d ON d."id" = r."deviceId"
    WHERE ${whereClause(filter)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  return {
    granularity,
    points: rows.map((row) => ({
      timestamp: row.bucket.toISOString(),
      kwh: round(row.kwh),
      cost: round(row.cost, 4),
      consumptionKwh: round(row.consumption),
      generationKwh: round(row.generation),
    })),
  };
}

// ---------------------------------------------------------------------------
// Summary / KPIs
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  netKwh: number;
  consumptionKwh: number;
  generationKwh: number;
  cost: number;
  carbonKg: number;
  peakKwh: number;
}

export interface SummaryResult {
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Percentage change vs the previous equal-length period. */
  change: { netKwh: number; cost: number; carbonKg: number };
  activeDevices: number;
  totalDevices: number;
  openAlerts: number;
  currency: string;
}

async function periodTotals(filter: RangeFilter, carbonKgPerKwh: number): Promise<PeriodTotals> {
  const [row] = await prisma.$queryRaw<
    { kwh: number | null; cost: number | null; consumption: number | null; generation: number | null; peak: number | null }[]
  >(Prisma.sql`
    SELECT
      SUM(r."kwh")::float8               AS kwh,
      SUM(r."cost")::float8              AS cost,
      SUM(GREATEST(r."kwh", 0))::float8  AS consumption,
      SUM(GREATEST(-r."kwh", 0))::float8 AS generation,
      MAX(r."kwh")::float8               AS peak
    FROM "Reading" r
    JOIN "Device" d ON d."id" = r."deviceId"
    WHERE ${whereClause(filter)}
  `);

  const netKwh = row?.kwh ?? 0;
  return {
    netKwh: round(netKwh),
    consumptionKwh: round(row?.consumption ?? 0),
    generationKwh: round(row?.generation ?? 0),
    cost: round(row?.cost ?? 0, 2),
    carbonKg: round(netKwh * carbonKgPerKwh),
    peakKwh: round(row?.peak ?? 0),
  };
}

export async function getSummary(filter: RangeFilter): Promise<SummaryResult> {
  const settings = await getSettings();
  const span = filter.to.getTime() - filter.from.getTime();
  const previousFilter: RangeFilter = {
    ...filter,
    from: new Date(filter.from.getTime() - span),
    to: filter.from,
  };

  const [current, previous, deviceCounts, openAlerts] = await Promise.all([
    periodTotals(filter, settings.carbonKgPerKwh),
    periodTotals(previousFilter, settings.carbonKgPerKwh),
    prisma.device.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: filter.locationIds?.length ? { locationId: { in: filter.locationIds } } : undefined,
    }),
    prisma.alert.count({
      where: {
        acknowledged: false,
        ...(filter.locationIds?.length
          ? { device: { locationId: { in: filter.locationIds } } }
          : {}),
      },
    }),
  ]);

  const totalDevices = deviceCounts.reduce((sum, group) => sum + group._count._all, 0);
  const activeDevices =
    deviceCounts.find((group) => group.status === 'ONLINE')?._count._all ?? 0;

  return {
    current,
    previous,
    change: {
      netKwh: percentChange(previous.netKwh, current.netKwh),
      cost: percentChange(previous.cost, current.cost),
      carbonKg: percentChange(previous.carbonKg, current.carbonKg),
    },
    activeDevices,
    totalDevices,
    openAlerts,
    currency: settings.currency,
  };
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export interface BreakdownSlice {
  key: string;
  label: string;
  kwh: number;
  cost: number;
  /** Share of total gross consumption, 0-100. Producers report 0. */
  share: number;
}

export async function getBreakdown(
  filter: RangeFilter,
  dimension: 'type' | 'location' | 'device',
): Promise<BreakdownSlice[]> {
  const groupSql =
    dimension === 'type'
      ? Prisma.sql`d."type"::text`
      : dimension === 'location'
        ? Prisma.sql`l."name"`
        : Prisma.sql`d."name"`;

  const keySql =
    dimension === 'type'
      ? Prisma.sql`d."type"::text`
      : dimension === 'location'
        ? Prisma.sql`l."id"`
        : Prisma.sql`d."id"`;

  const rows = await prisma.$queryRaw<{ key: string; label: string; kwh: number; cost: number }[]>(
    Prisma.sql`
      SELECT
        ${keySql}                 AS key,
        ${groupSql}               AS label,
        SUM(r."kwh")::float8      AS kwh,
        SUM(r."cost")::float8     AS cost
      FROM "Reading" r
      JOIN "Device" d   ON d."id" = r."deviceId"
      JOIN "Location" l ON l."id" = d."locationId"
      WHERE ${whereClause(filter)}
      GROUP BY key, label
      ORDER BY kwh DESC
    `,
  );

  // Share is computed against gross consumption so that solar (negative) does
  // not inflate everyone else's percentage past 100.
  const gross = rows.reduce((sum, row) => sum + Math.max(row.kwh, 0), 0);

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    kwh: round(row.kwh),
    cost: round(row.cost, 2),
    share: gross > 0 ? round((Math.max(row.kwh, 0) / gross) * 100, 1) : 0,
  }));
}

// ---------------------------------------------------------------------------
// Heatmap (hour-of-day x day-of-week)
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  /** 0 = Sunday, matching JS `Date#getDay`. */
  dayOfWeek: number;
  hour: number;
  kwh: number;
  /** Mean kWh per occurrence of this slot, which is what the UI colours by. */
  avgKwh: number;
}

export async function getHeatmap(filter: RangeFilter): Promise<HeatmapCell[]> {
  const rows = await prisma.$queryRaw<
    { dow: number; hour: number; kwh: number; slots: bigint }[]
  >(Prisma.sql`
    WITH local AS (
      SELECT
        r."kwh",
        (r."timestamp" AT TIME ZONE 'UTC' AT TIME ZONE ${filter.timezone}) AS ts
      FROM "Reading" r
      JOIN "Device" d ON d."id" = r."deviceId"
      WHERE ${whereClause(filter)}
    )
    SELECT
      EXTRACT(DOW  FROM ts)::int      AS dow,
      EXTRACT(HOUR FROM ts)::int      AS hour,
      SUM("kwh")::float8              AS kwh,
      COUNT(DISTINCT date_trunc('day', ts)) AS slots
    FROM local
    GROUP BY dow, hour
    ORDER BY dow, hour
  `);

  return rows.map((row) => ({
    dayOfWeek: row.dow,
    hour: row.hour,
    kwh: round(row.kwh),
    avgKwh: round(row.kwh / Math.max(1, Number(row.slots))),
  }));
}

// ---------------------------------------------------------------------------
// Cost projection
// ---------------------------------------------------------------------------

export interface ProjectionResult {
  /** Cost accrued so far in the current calendar month. */
  monthToDateCost: number;
  monthToDateKwh: number;
  /** Straight-line projection for the full month based on the daily run rate. */
  projectedCost: number;
  projectedKwh: number;
  /** Actual total for the previous calendar month, for comparison. */
  previousMonthCost: number;
  dailyRunRateCost: number;
  daysElapsed: number;
  daysInMonth: number;
  currency: string;
}

export async function getProjection(timezone: string): Promise<ProjectionResult> {
  const settings = await getSettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Elapsed time as a fraction of a day gives a smoother run rate than an
  // integer day count, which would jump discontinuously at midnight.
  const daysElapsed = Math.max(
    0.25,
    (now.getTime() - monthStart.getTime()) / 86_400_000,
  );

  const [mtd, previousMonth] = await Promise.all([
    periodTotals({ from: monthStart, to: now, timezone }, settings.carbonKgPerKwh),
    periodTotals(
      { from: previousMonthStart, to: monthStart, timezone },
      settings.carbonKgPerKwh,
    ),
  ]);

  const dailyRunRateCost = mtd.cost / daysElapsed;

  return {
    monthToDateCost: mtd.cost,
    monthToDateKwh: mtd.netKwh,
    projectedCost: round(dailyRunRateCost * daysInMonth, 2),
    projectedKwh: round((mtd.netKwh / daysElapsed) * daysInMonth),
    previousMonthCost: previousMonth.cost,
    dailyRunRateCost: round(dailyRunRateCost, 2),
    daysElapsed: round(daysElapsed, 1),
    daysInMonth,
    currency: settings.currency,
  };
}

// ---------------------------------------------------------------------------
// Comparison (device vs device, location vs location)
// ---------------------------------------------------------------------------

export interface ComparisonSeries {
  key: string;
  label: string;
  totalKwh: number;
  totalCost: number;
  points: { timestamp: string; kwh: number }[];
}

export async function getComparison(
  filter: RangeFilter,
  dimension: 'device' | 'location',
  granularity: Granularity = autoGranularity(filter.from, filter.to),
): Promise<{ granularity: Granularity; series: ComparisonSeries[] }> {
  const keySql = dimension === 'device' ? Prisma.sql`d."id"` : Prisma.sql`l."id"`;
  const labelSql = dimension === 'device' ? Prisma.sql`d."name"` : Prisma.sql`l."name"`;

  const rows = await prisma.$queryRaw<
    { key: string; label: string; bucket: Date; kwh: number; cost: number }[]
  >(Prisma.sql`
    SELECT
      ${keySql}   AS key,
      ${labelSql} AS label,
      ${bucketExpr(granularity, filter.timezone)} AS bucket,
      SUM(r."kwh")::float8  AS kwh,
      SUM(r."cost")::float8 AS cost
    FROM "Reading" r
    JOIN "Device" d   ON d."id" = r."deviceId"
    JOIN "Location" l ON l."id" = d."locationId"
    WHERE ${whereClause(filter)}
    GROUP BY key, label, bucket
    ORDER BY bucket ASC
  `);

  const grouped = new Map<string, ComparisonSeries>();
  for (const row of rows) {
    let series = grouped.get(row.key);
    if (!series) {
      series = { key: row.key, label: row.label, totalKwh: 0, totalCost: 0, points: [] };
      grouped.set(row.key, series);
    }
    series.points.push({ timestamp: row.bucket.toISOString(), kwh: round(row.kwh) });
    series.totalKwh += row.kwh;
    series.totalCost += row.cost;
  }

  const series = [...grouped.values()]
    .map((entry) => ({
      ...entry,
      totalKwh: round(entry.totalKwh),
      totalCost: round(entry.totalCost, 2),
    }))
    .sort((a, b) => b.totalKwh - a.totalKwh);

  return { granularity, series };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Percentage change, guarding the divide-by-zero case. */
export function percentChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}
