import type { HeartRateZone } from "../../types/analytics";
import type { TrackPoint } from "../../types/workout";

const BANDS = [
  { zone: 1 as const, label: "Recovery", low: 0.5, high: 0.6 },
  { zone: 2 as const, label: "Aerobic", low: 0.6, high: 0.7 },
  { zone: 3 as const, label: "Tempo", low: 0.7, high: 0.8 },
  { zone: 4 as const, label: "Threshold", low: 0.8, high: 0.9 },
  { zone: 5 as const, label: "Maximum", low: 0.9, high: 1.01 }
];

/** Default max HR = 220 - age; a measured max HR can override this estimate. */
export function estimateMaxHeartRate(age: number, measuredMaxHr?: number | null): number {
  if (measuredMaxHr && measuredMaxHr >= 100 && measuredMaxHr <= 230) return measuredMaxHr;
  if (!Number.isFinite(age) || age < 13 || age > 100) throw new Error("Age must be between 13 and 100.");
  return 220 - age;
}

/** Assign each interval to the zone of its starting HR sample; missing HR is excluded. */
export function calculateHeartRateZones(
  points: TrackPoint[], age: number, measuredMaxHr?: number | null
): HeartRateZone[] {
  const maxHr = estimateMaxHeartRate(age, measuredMaxHr);
  const seconds = BANDS.map(() => 0);
  for (let i = 0; i < points.length - 1; i++) {
    const hr = points[i].heartRateBpm;
    const dt = Math.max(0, (points[i + 1].timeMs - points[i].timeMs) / 1000);
    if (hr === null || dt > 10 || dt <= 0) continue;
    const index = BANDS.findIndex((band, n) => {
      const upper = n === BANDS.length - 1 ? Infinity : band.high * maxHr;
      return hr >= band.low * maxHr && hr < upper;
    });
    if (index >= 0) seconds[index] += dt;
  }
  const total = seconds.reduce((sum, value) => sum + value, 0);
  return BANDS.map((band, i) => ({
    zone: band.zone, label: band.label,
    lowerBpm: Math.round(band.low * maxHr),
    upperBpm: i === BANDS.length - 1 ? maxHr : Math.round(band.high * maxHr),
    seconds: seconds[i], percent: total ? seconds[i] / total * 100 : 0
  }));
}
