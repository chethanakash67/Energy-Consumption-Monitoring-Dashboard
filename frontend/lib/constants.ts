import type { AlertType, DeviceStatus, DeviceType, RangeKey, Severity } from './types';

/**
 * Domain display metadata.
 *
 * Device types map to *fixed* categorical slots — a type keeps its colour no
 * matter how many types a given chart happens to show. Colour follows the
 * entity, never its rank, so filtering the chart never repaints the survivors.
 */
export const DEVICE_TYPE_META: Record<
  DeviceType,
  { label: string; short: string; colorVar: string; seriesIndex: number }
> = {
  HVAC: { label: 'HVAC', short: 'HVAC', colorVar: 'var(--series-1)', seriesIndex: 1 },
  SERVER_ROOM: {
    label: 'Server room',
    short: 'Servers',
    colorVar: 'var(--series-2)',
    seriesIndex: 2,
  },
  MACHINERY: {
    label: 'Machinery',
    short: 'Machinery',
    colorVar: 'var(--series-3)',
    seriesIndex: 3,
  },
  REFRIGERATION: {
    label: 'Refrigeration',
    short: 'Cooling',
    colorVar: 'var(--series-4)',
    seriesIndex: 4,
  },
  EV_CHARGER: {
    label: 'EV charging',
    short: 'EV',
    colorVar: 'var(--series-5)',
    seriesIndex: 5,
  },
  LIGHTING: {
    label: 'Lighting',
    short: 'Lighting',
    colorVar: 'var(--series-6)',
    seriesIndex: 6,
  },
  APPLIANCE: {
    label: 'Appliances',
    short: 'Plug load',
    colorVar: 'var(--series-7)',
    seriesIndex: 7,
  },
  SOLAR: { label: 'Solar PV', short: 'Solar', colorVar: 'var(--series-8)', seriesIndex: 8 },
};

export const DEVICE_TYPES = Object.keys(DEVICE_TYPE_META) as DeviceType[];

/** Ordered categorical slots, for charts that colour by an arbitrary entity. */
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
];

/** Assigns a stable slot by index; beyond 8 entities the caller must group. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/** Sequential ramp used by the heatmap (magnitude encoding, single hue). */
export const SEQUENTIAL_RAMP = [
  'var(--seq-1)',
  'var(--seq-2)',
  'var(--seq-3)',
  'var(--seq-4)',
  'var(--seq-5)',
  'var(--seq-6)',
  'var(--seq-7)',
];

export const DEVICE_STATUS_META: Record<
  DeviceStatus,
  { label: string; tone: 'optimal' | 'neutral' | 'critical' }
> = {
  ONLINE: { label: 'Online', tone: 'optimal' },
  IDLE: { label: 'Idle', tone: 'neutral' },
  OFFLINE: { label: 'Offline', tone: 'critical' },
};

/**
 * Severity maps onto the semantic energy-state tokens rather than raw
 * red/yellow/green, so alerts sit in the same visual language as the charts.
 */
export const SEVERITY_META: Record<
  Severity,
  { label: string; tone: 'elevated' | 'high' | 'critical'; rank: number }
> = {
  INFO: { label: 'Info', tone: 'elevated', rank: 0 },
  WARNING: { label: 'Warning', tone: 'high', rank: 1 },
  CRITICAL: { label: 'Critical', tone: 'critical', rank: 2 },
};

export const ALERT_TYPE_META: Record<AlertType, { label: string; description: string }> = {
  SPIKE: { label: 'Usage spike', description: 'Consumption well above the expected baseline' },
  THRESHOLD: { label: 'Threshold', description: 'Configured kWh limit exceeded' },
  OFFLINE: { label: 'Offline', description: 'Device stopped reporting' },
  EFFICIENCY: { label: 'Efficiency', description: 'Output below expected for conditions' },
};

export const RANGE_OPTIONS: { value: RangeKey; label: string; description: string }[] = [
  { value: '24h', label: '24h', description: 'Last 24 hours' },
  { value: '7d', label: '7d', description: 'Last 7 days' },
  { value: '30d', label: '30d', description: 'Last 30 days' },
  { value: '90d', label: '90d', description: 'Last 90 days' },
];

/** Sunday-first, matching Postgres `EXTRACT(DOW)` and JS `Date#getDay`. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
