import type { Granularity } from './types';

/**
 * Formatting helpers.
 *
 * Axis ticks, tooltips, and KPI values all route through here so units and
 * precision stay consistent everywhere in the product.
 */

/** Compact energy value with a unit that scales: 940 kWh, 12.4 MWh, 1.2 GWh. */
export function formatEnergy(kwh: number, options: { decimals?: number } = {}): string {
  const magnitude = Math.abs(kwh);
  const sign = kwh < 0 ? '-' : '';

  if (magnitude >= 1_000_000) {
    return `${sign}${trim(magnitude / 1_000_000, options.decimals ?? 2)} GWh`;
  }
  if (magnitude >= 1_000) {
    return `${sign}${trim(magnitude / 1_000, options.decimals ?? 2)} MWh`;
  }
  return `${sign}${trim(magnitude, options.decimals ?? (magnitude < 10 ? 2 : 1))} kWh`;
}

/** Bare number for axis ticks — the axis label carries the unit. */
export function formatEnergyTick(kwh: number): string {
  const magnitude = Math.abs(kwh);
  const sign = kwh < 0 ? '-' : '';
  if (magnitude >= 1_000_000) return `${sign}${trim(magnitude / 1_000_000, 1)}G`;
  if (magnitude >= 1_000) return `${sign}${trim(magnitude / 1_000, 1)}k`;
  if (magnitude >= 10) return `${sign}${Math.round(magnitude)}`;
  return `${sign}${trim(magnitude, 1)}`;
}

export function formatPower(kw: number, decimals = 1): string {
  const magnitude = Math.abs(kw);
  const sign = kw < 0 ? '-' : '';
  if (magnitude >= 1_000) return `${sign}${trim(magnitude / 1_000, 2)} MW`;
  return `${sign}${trim(magnitude, decimals)} kW`;
}

export function formatCurrency(
  value: number,
  currency = 'USD',
  options: { compact?: boolean; decimals?: number } = {},
): string {
  const { compact = false, decimals } = options;

  // Money reads as broken when the cents are ragged ("$100.7" next to
  // "$28.94"), so below the whole-dollar cutoff both bounds are pinned to 2.
  const wholeDollars = Math.abs(value) >= 1000;
  const fractionDigits = decimals ?? (wholeDollars ? 0 : 2);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** Currency for axis ticks — always compact, never fractional. */
export function formatCurrencyTick(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCarbon(kg: number): string {
  const magnitude = Math.abs(kg);
  const sign = kg < 0 ? '-' : '';
  if (magnitude >= 1_000) return `${sign}${trim(magnitude / 1_000, 2)} t`;
  return `${sign}${trim(magnitude, magnitude < 10 ? 1 : 0)} kg`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value > 0 ? '+' : ''}${trim(value, decimals)}%`;
}

/**
 * Axis tick label appropriate to the bucket size.
 *
 * `multiDay` matters for hourly buckets: over a 7-day range the axis only has
 * room for ~7 ticks, so consecutive ticks land ~23 hours apart. Labelling
 * those with the hour alone produces a sequence like "11 PM, 9 PM, 7 PM" that
 * reads as if time runs backwards. When the series spans more than a day the
 * date is the meaningful part, so that is what the tick shows.
 */
export function formatAxisTime(
  timestamp: string,
  granularity: Granularity,
  multiDay = false,
): string {
  const date = new Date(timestamp);

  if (granularity === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (multiDay) {
    // Midnight ticks get the bare date; anything else keeps the hour for
    // context, prefixed by the day so ordering stays unambiguous.
    if (date.getHours() === 0) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  }

  if (granularity === 'interval') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

/** True when a series crosses more than one calendar day. */
export function spansMultipleDays(points: { timestamp: string }[]): boolean {
  if (points.length < 2) return false;
  const first = new Date(points[0].timestamp);
  const last = new Date(points[points.length - 1].timestamp);
  return last.getTime() - first.getTime() > 36 * 3_600_000;
}

/** Full, unambiguous timestamp for tooltips. */
export function formatTooltipTime(timestamp: string, granularity: Granularity): string {
  const date = new Date(timestamp);
  if (granularity === 'day') {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Minutes covered by one stored reading; mirrors the backend's cadence. */
export const INTERVAL_MINUTES = 15;

/**
 * When a reading actually completed.
 *
 * Readings are stamped with the *start* of their interval, so a freshly
 * written 15-minute bucket can look up to 30 minutes stale in a "last seen"
 * column. Reporting the interval's end is both more accurate as a freshness
 * signal and what an operator means by "last reading".
 */
export function readingCompletedAt(timestamp: string): Date {
  return new Date(new Date(timestamp).getTime() + INTERVAL_MINUTES * 60_000);
}

/** "3m ago", "2h ago", "5d ago" — used in feeds and status lines. */
export function formatRelative(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`;
  return formatDate(date.toISOString());
}

/** Drops trailing zeros so "12.50" renders as "12.5" but "12.00" as "12". */
function trim(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toLocaleString('en-US', {
    maximumFractionDigits: decimals,
  });
}
