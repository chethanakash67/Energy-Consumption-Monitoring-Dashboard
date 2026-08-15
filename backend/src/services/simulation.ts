import { DeviceType } from '@prisma/client';
import { INTERVAL_MINUTES } from '../lib/config';

/**
 * Synthetic-but-realistic energy model.
 *
 * There is no physical hardware behind this dashboard, so every reading comes
 * from here. The same model backs both the historical seed and the live
 * simulator worker, which means charts stay continuous across the "now"
 * boundary instead of visibly changing character.
 *
 * A device's instantaneous demand is composed as:
 *
 *   kW = ratedCapacity x hourShape x weekdayFactor x seasonFactor x noise x anomaly
 *
 * Each factor is deterministic given (device, timestamp) except for noise and
 * anomalies, so re-running the seed produces a comparable-looking dataset.
 */

/** 24 hourly multipliers (0..1-ish) describing a typical daily load shape. */
type HourShape = readonly number[];

interface TypeProfile {
  /** Weekday demand curve by hour of day. */
  weekday: HourShape;
  /** Weekend demand curve — many device classes behave very differently. */
  weekend: HourShape;
  /** Fraction of rated capacity drawn at the curve's peak. */
  peakUtilisation: number;
  /** Relative demand by month index (0 = January) — captures seasonality. */
  seasonal: readonly number[];
  /** Std-dev of multiplicative noise. Bursty devices get a larger value. */
  noise: number;
  /** Probability per interval of an anomalous spike. */
  anomalyRate: number;
  /** Multiplier range applied when an anomaly fires. */
  anomalyMagnitude: [number, number];
  /** True for generators (solar) — readings are stored as negative kWh. */
  producer?: boolean;
}

const FLAT = Array.from({ length: 24 }, () => 1);

/** Bell curve helper used for daylight-shaped profiles. */
function bell(center: number, width: number, height = 1): HourShape {
  return Array.from({ length: 24 }, (_, hour) => {
    const value = height * Math.exp(-((hour - center) ** 2) / (2 * width ** 2));
    return value < 0.01 ? 0 : value;
  });
}

const PROFILES: Record<DeviceType, TypeProfile> = {
  // Climate control: occupancy-driven, with a strong summer/winter split.
  HVAC: {
    weekday: [
      0.32, 0.28, 0.26, 0.26, 0.3, 0.45, 0.72, 0.88, 0.95, 0.92, 0.9, 0.93, 0.97,
      1.0, 0.98, 0.94, 0.88, 0.78, 0.66, 0.55, 0.47, 0.42, 0.38, 0.34,
    ],
    weekend: [
      0.3, 0.27, 0.25, 0.25, 0.27, 0.32, 0.4, 0.48, 0.55, 0.6, 0.63, 0.66, 0.68,
      0.68, 0.66, 0.62, 0.58, 0.53, 0.48, 0.44, 0.4, 0.37, 0.34, 0.31,
    ],
    peakUtilisation: 0.78,
    // Summer cooling peak (Jun-Aug) and a secondary winter heating peak.
    seasonal: [0.95, 0.9, 0.72, 0.55, 0.66, 0.88, 1.0, 1.0, 0.84, 0.6, 0.72, 0.92],
    noise: 0.07,
    anomalyRate: 0.0016,
    anomalyMagnitude: [1.5, 2.3],
  },

  // Lighting: dark-hours driven, dips at midday when daylight is available.
  LIGHTING: {
    weekday: [
      0.18, 0.15, 0.14, 0.14, 0.18, 0.35, 0.68, 0.85, 0.8, 0.66, 0.55, 0.5, 0.48,
      0.5, 0.55, 0.66, 0.82, 0.95, 1.0, 0.94, 0.8, 0.6, 0.38, 0.24,
    ],
    weekend: [
      0.2, 0.17, 0.15, 0.14, 0.15, 0.2, 0.3, 0.42, 0.5, 0.52, 0.5, 0.48, 0.46,
      0.47, 0.52, 0.62, 0.8, 0.95, 1.0, 0.96, 0.86, 0.68, 0.46, 0.3,
    ],
    peakUtilisation: 0.72,
    // Longer nights in winter mean more lighting demand.
    seasonal: [1.12, 1.05, 0.95, 0.85, 0.78, 0.74, 0.76, 0.82, 0.92, 1.02, 1.1, 1.15],
    noise: 0.05,
    anomalyRate: 0.0008,
    anomalyMagnitude: [1.4, 1.9],
  },

  // General plug load / office appliances: morning and evening humps.
  APPLIANCE: {
    weekday: [
      0.22, 0.2, 0.19, 0.19, 0.22, 0.34, 0.58, 0.8, 0.72, 0.6, 0.58, 0.68, 0.78,
      0.7, 0.62, 0.62, 0.72, 0.9, 1.0, 0.92, 0.74, 0.55, 0.38, 0.27,
    ],
    weekend: [
      0.24, 0.21, 0.2, 0.2, 0.21, 0.26, 0.38, 0.55, 0.7, 0.78, 0.8, 0.84, 0.88,
      0.8, 0.72, 0.7, 0.78, 0.92, 1.0, 0.9, 0.74, 0.58, 0.42, 0.3,
    ],
    peakUtilisation: 0.6,
    seasonal: [1.0, 0.98, 0.96, 0.94, 0.95, 1.0, 1.05, 1.05, 1.0, 0.96, 0.98, 1.04],
    noise: 0.11,
    anomalyRate: 0.0012,
    anomalyMagnitude: [1.6, 2.6],
  },

  // Refrigeration: always on, compressor duty-cycles with ambient temperature.
  REFRIGERATION: {
    weekday: [
      0.78, 0.75, 0.73, 0.72, 0.73, 0.78, 0.85, 0.92, 0.95, 0.96, 0.98, 1.0, 1.0,
      0.99, 0.98, 0.96, 0.94, 0.93, 0.92, 0.9, 0.88, 0.85, 0.82, 0.8,
    ],
    weekend: [
      0.76, 0.74, 0.72, 0.71, 0.72, 0.75, 0.8, 0.86, 0.9, 0.92, 0.94, 0.96, 0.96,
      0.95, 0.94, 0.93, 0.92, 0.91, 0.9, 0.88, 0.86, 0.83, 0.8, 0.78,
    ],
    peakUtilisation: 0.66,
    seasonal: [0.85, 0.86, 0.9, 0.95, 1.02, 1.1, 1.16, 1.16, 1.06, 0.96, 0.89, 0.85],
    noise: 0.06,
    anomalyRate: 0.0014,
    // A failing door seal or defrost fault shows up as a sustained step change.
    anomalyMagnitude: [1.35, 1.8],
  },

  // EV charging: highly bursty — either drawing near-rated power, or nothing.
  EV_CHARGER: {
    weekday: [
      0.55, 0.6, 0.55, 0.4, 0.25, 0.15, 0.2, 0.35, 0.6, 0.7, 0.65, 0.6, 0.62,
      0.6, 0.58, 0.6, 0.7, 0.9, 1.0, 0.95, 0.85, 0.78, 0.7, 0.62,
    ],
    weekend: [
      0.5, 0.52, 0.48, 0.35, 0.22, 0.14, 0.16, 0.24, 0.4, 0.58, 0.68, 0.72, 0.72,
      0.7, 0.68, 0.68, 0.74, 0.86, 0.92, 0.88, 0.8, 0.72, 0.64, 0.56,
    ],
    peakUtilisation: 0.7,
    seasonal: [1.08, 1.06, 1.0, 0.96, 0.94, 0.95, 0.98, 0.98, 0.96, 0.98, 1.04, 1.1],
    noise: 0.3,
    anomalyRate: 0.002,
    anomalyMagnitude: [1.5, 2.1],
  },

  // Industrial machinery: shift-bound, essentially off at weekends.
  MACHINERY: {
    weekday: [
      0.08, 0.07, 0.07, 0.07, 0.1, 0.3, 0.72, 0.95, 1.0, 1.0, 0.98, 0.86, 0.72,
      0.95, 1.0, 0.98, 0.9, 0.6, 0.28, 0.14, 0.1, 0.09, 0.08, 0.08,
    ],
    weekend: [
      0.07, 0.06, 0.06, 0.06, 0.06, 0.08, 0.12, 0.18, 0.22, 0.24, 0.24, 0.22,
      0.2, 0.2, 0.19, 0.18, 0.16, 0.13, 0.1, 0.08, 0.07, 0.07, 0.06, 0.06,
    ],
    peakUtilisation: 0.82,
    seasonal: [0.96, 1.0, 1.04, 1.02, 1.0, 0.98, 0.88, 0.86, 1.02, 1.06, 1.04, 0.9],
    noise: 0.14,
    anomalyRate: 0.0022,
    anomalyMagnitude: [1.6, 2.8],
  },

  // Server room: flat, high baseline; cooling adds a mild seasonal tilt.
  SERVER_ROOM: {
    weekday: FLAT.map((_, hour) => 0.9 + 0.1 * Math.sin(((hour - 6) / 24) * 2 * Math.PI)),
    weekend: FLAT.map((_, hour) => 0.86 + 0.08 * Math.sin(((hour - 6) / 24) * 2 * Math.PI)),
    peakUtilisation: 0.74,
    seasonal: [0.94, 0.94, 0.96, 0.98, 1.02, 1.06, 1.1, 1.1, 1.04, 0.99, 0.96, 0.94],
    noise: 0.035,
    anomalyRate: 0.001,
    anomalyMagnitude: [1.3, 1.7],
  },

  // Solar PV: daylight bell curve, negative energy (generation).
  SOLAR: {
    weekday: bell(12.6, 3.1),
    weekend: bell(12.6, 3.1),
    peakUtilisation: 0.82,
    seasonal: [0.55, 0.66, 0.82, 0.95, 1.05, 1.12, 1.12, 1.05, 0.92, 0.75, 0.58, 0.5],
    noise: 0.16, // cloud cover
    anomalyRate: 0.0012,
    // "Anomaly" for a producer = an inverter fault / heavy cloud, i.e. a dropout.
    anomalyMagnitude: [0.15, 0.45],
    producer: true,
  },
};

/** Time-of-use tariff multipliers applied on top of the base rate. */
const TOU_MULTIPLIER: readonly number[] = [
  0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.85, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.42, 1.55, 1.55, 1.42, 1.15, 1.0, 0.85, 0.72,
];

export function touMultiplier(date: Date): number {
  return TOU_MULTIPLIER[date.getHours()];
}

/** Box-Muller transform — normal noise looks far more natural than uniform. */
function gaussian(mean = 0, stdDev = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Stable per-device offset in [0.85, 1.15] so two devices of the same type in
 * the same building don't trace identical curves.
 */
function deviceBias(deviceId: string): number {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) % 100000;
  }
  return 0.85 + (hash % 300) / 1000;
}

/** Smooth interpolation between neighbouring hourly points on a load curve. */
function shapeAt(shape: HourShape, date: Date): number {
  const hour = date.getHours();
  const fraction = (date.getMinutes() * 60 + date.getSeconds()) / 3600;
  const current = shape[hour];
  const next = shape[(hour + 1) % 24];
  return current + (next - current) * fraction;
}

export interface SimDevice {
  id: string;
  type: DeviceType;
  ratedCapacityKw: number;
  status?: 'ONLINE' | 'OFFLINE' | 'IDLE';
}

export interface SimSample {
  /** Instantaneous demand in kW (negative for generation). */
  kw: number;
  /** True when an anomaly multiplier was applied to this sample. */
  anomalous: boolean;
  /** The demand that *would* have been expected without noise or anomaly. */
  baselineKw: number;
}

/**
 * Instantaneous demand for a device at a point in time.
 *
 * `allowAnomaly` is disabled for baseline lookups so that anomaly detection can
 * compare an observed sample against a clean expectation.
 */
export function sampleDevice(
  device: SimDevice,
  at: Date,
  options: { allowAnomaly?: boolean; allowNoise?: boolean } = {},
): SimSample {
  const { allowAnomaly = true, allowNoise = true } = options;
  const profile = PROFILES[device.type];

  const isWeekend = at.getDay() === 0 || at.getDay() === 6;
  const shape = shapeAt(isWeekend ? profile.weekend : profile.weekday, at);
  const season = profile.seasonal[at.getMonth()];
  const bias = deviceBias(device.id);

  const baselineKw =
    device.ratedCapacityKw * profile.peakUtilisation * shape * season * bias;

  if (device.status === 'OFFLINE') {
    return { kw: 0, anomalous: false, baselineKw };
  }

  let kw = baselineKw;

  if (allowNoise) {
    // Clamp the noise multiplier so a fat tail can't produce a negative load.
    kw *= Math.max(0.25, gaussian(1, profile.noise));
  }

  let anomalous = false;
  if (allowAnomaly && Math.random() < profile.anomalyRate && shape > 0.15) {
    const [low, high] = profile.anomalyMagnitude;
    kw *= low + Math.random() * (high - low);
    anomalous = true;
  }

  // An idle device trickles standby power only.
  if (device.status === 'IDLE') {
    kw *= 0.12;
  }

  const sign = profile.producer ? -1 : 1;
  return {
    kw: sign * Math.max(0, kw),
    anomalous,
    baselineKw: sign * Math.max(0, baselineKw),
  };
}

/** Convert an instantaneous kW sample into energy for one storage interval. */
export function kwToIntervalKwh(kw: number): number {
  return (kw * INTERVAL_MINUTES) / 60;
}

/** Interval cost, applying the time-of-use multiplier for that hour. */
export function costForInterval(kwh: number, at: Date, tariffPerKwh: number): number {
  return kwh * tariffPerKwh * touMultiplier(at);
}

export function isProducer(type: DeviceType): boolean {
  return PROFILES[type].producer === true;
}
