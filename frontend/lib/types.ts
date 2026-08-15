/** Shared API types, mirroring the backend's Prisma models and DTOs. */

export type Role = 'ADMIN' | 'VIEWER';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 'SPIKE' | 'THRESHOLD' | 'OFFLINE' | 'EFFICIENCY';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'IDLE';
export type DeviceType =
  | 'HVAC'
  | 'LIGHTING'
  | 'APPLIANCE'
  | 'REFRIGERATION'
  | 'EV_CHARGER'
  | 'MACHINERY'
  | 'SERVER_ROOM'
  | 'SOLAR';

export type RangeKey = '24h' | '7d' | '30d' | '90d' | 'custom';
export type Granularity = 'interval' | 'hour' | 'day';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  theme: 'light' | 'dark' | 'system';
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyMinLevel: Severity;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  deviceCount: number;
  createdAt: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  ratedCapacityKw: number;
  thresholdKwh: number | null;
  installedAt: string;
  locationId: string;
  location: { id: string; name: string; timezone: string };
  kwh24h: number;
  cost24h: number;
  lastReadingAt: string | null;
  efficiency: number;
  isProducer: boolean;
}

export interface DeviceDetail extends Device {
  peakIntervalKwh: number;
  avgIntervalKwh: number;
  openAlerts: number;
}

export interface SeriesPoint {
  timestamp: string;
  kwh: number;
  cost: number;
  consumptionKwh: number;
  generationKwh: number;
}

export interface SeriesResponse {
  granularity: Granularity;
  points: SeriesPoint[];
}

export interface PeriodTotals {
  netKwh: number;
  consumptionKwh: number;
  generationKwh: number;
  cost: number;
  carbonKg: number;
  peakKwh: number;
}

export interface Summary {
  current: PeriodTotals;
  previous: PeriodTotals;
  change: { netKwh: number; cost: number; carbonKg: number };
  activeDevices: number;
  totalDevices: number;
  openAlerts: number;
  currency: string;
}

export interface BreakdownSlice {
  key: string;
  label: string;
  kwh: number;
  cost: number;
  share: number;
}

export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  kwh: number;
  avgKwh: number;
}

export interface Projection {
  monthToDateCost: number;
  monthToDateKwh: number;
  projectedCost: number;
  projectedKwh: number;
  previousMonthCost: number;
  dailyRunRateCost: number;
  daysElapsed: number;
  daysInMonth: number;
  currency: string;
}

export interface RealtimeSource {
  name: string;
  url: string;
  apiKeyRequired: boolean;
  usedFor: string[];
}

export interface RealtimeSnapshot {
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

export interface RealtimeStatus {
  enabled: boolean;
  running: boolean;
  pollMs: number;
  lastPullAt: string | null;
  lastError: string | null;
  latest: RealtimeSnapshot | null;
  sources: RealtimeSource[];
}

export interface ComparisonSeries {
  key: string;
  label: string;
  totalKwh: number;
  totalCost: number;
  points: { timestamp: string; kwh: number }[];
}

export interface Alert {
  id: string;
  deviceId: string;
  type: AlertType;
  severity: Severity;
  message: string;
  value: number;
  baseline: number | null;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  acknowledgedBy?: { id: string; name: string } | null;
  device: {
    id: string;
    name: string;
    type: DeviceType;
    location: { id: string; name: string };
  };
}

export interface AlertsResponse {
  alerts: Alert[];
  nextCursor: string | null;
  openCounts: { total: number; critical: number; warning: number; info: number };
}

export interface AppSettings {
  tariffPerKwh: number;
  carbonKgPerKwh: number;
  currency: string;
}

/** Payload of the SSE `live` event. */
export interface LivePayload {
  timestamp: string;
  totalKw: number;
  demandKw: number;
  generationKw: number;
  costPerHour: number;
  devices: { deviceId: string; name: string; kw: number }[];
}
