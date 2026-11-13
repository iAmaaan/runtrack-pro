import type { TrackPoint } from "../../types/workout";
import type { WorkoutSummary } from "../../types/analytics";
import { average, movingAverage } from "../processing/math";

export interface SummaryOptions {
  movingSpeedThresholdMps?: number;
  altitudeWindow?: number;
}

/** Summarize duration, speed, HR and smoothed elevation without summing raw GPS altitude noise. */
export function calculateWorkoutSummary(
  points: TrackPoint[], elapsedSeconds: number, distanceM: number, calories: number | null,
  options: SummaryOptions = {}
): WorkoutSummary {
  const threshold = options.movingSpeedThresholdMps ?? 0.5;
  const movingIntervals = points.slice(1).map((p, i) => {
    const previous = points[i];
    const dt = Math.max(0, (p.timeMs - previous.timeMs) / 1000);
    return { dt, speed: p.speedMps };
  }).filter(x => x.dt > 0 && x.dt <= 1.5);
  const movingSeconds = movingIntervals.filter(x => (x.speed ?? 0) >= threshold).reduce((s, x) => s + x.dt, 0);
  const countedSeconds = movingIntervals.reduce((s, x) => s + x.dt, 0);
  const stoppedSeconds = Math.max(0, Math.min(elapsedSeconds, countedSeconds) - movingSeconds);
  const movingDistance = movingIntervals.filter(x => (x.speed ?? 0) >= threshold)
    .reduce((s, x) => s + (x.speed ?? 0) * x.dt, 0);
  const speeds = movingIntervals.map(x => x.speed).filter((x): x is number => x !== null && Number.isFinite(x) && x >= 0);
  const hrs = points.map(p => p.heartRateBpm);
  const altitudes = points.map(p => p.altitudeM);
  const smoothedAltitude = movingAverage(altitudes, options.altitudeWindow ?? 11);
  let gain = 0, loss = 0;
  for (let i = 1; i < smoothedAltitude.length; i++) {
    const a = smoothedAltitude[i - 1], b = smoothedAltitude[i];
    if (a === null || b === null) continue;
    const change = b - a;
    // Ignore tiny residual changes after smoothing to avoid manufacturing elevation gain.
    if (change > 1.5) gain += change;
    else if (change < -1.5) loss += Math.abs(change);
  }
  const validAlt = altitudes.filter((x): x is number => x !== null && Number.isFinite(x));
  return {
    distanceM, elapsedSeconds, movingSeconds, stoppedSeconds,
    averagePaceSecPerKm: distanceM > 0 ? elapsedSeconds / (distanceM / 1000) : null,
    movingPaceSecPerKm: movingDistance > 0 ? movingSeconds / (movingDistance / 1000) : null,
    maxSpeedMps: speeds.length ? Math.max(...speeds) : null,
    averageHeartRateBpm: average(hrs),
    minHeartRateBpm: hrs.some(x => x !== null) ? Math.min(...hrs.filter((x): x is number => x !== null)) : null,
    maxHeartRateBpm: hrs.some(x => x !== null) ? Math.max(...hrs.filter((x): x is number => x !== null)) : null,
    calories,
    elevationMinM: validAlt.length ? Math.min(...validAlt) : null,
    elevationMaxM: validAlt.length ? Math.max(...validAlt) : null,
    smoothedElevationGainM: gain, smoothedElevationLossM: loss
  };
}
