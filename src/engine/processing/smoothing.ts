import type { AnalyticsSeries } from "../../types/analytics";
import type { TrackPoint } from "../../types/workout";
import { movingAverage } from "./math";

/** Smooth noisy one-second speed samples with a 25-sample centred moving average. */
export function buildAnalyticsSeries(points: TrackPoint[]): AnalyticsSeries {
  const smoothedSpeedMps = movingAverage(points.map(p => p.speedMps), 25).map(v => v ?? 0);
  return {
    raw: points,
    smoothedSpeedMps,
    smoothedPaceSecPerKm: smoothedSpeedMps.map(speed => speed > 0 ? 1000 / speed : 0),
    // A shorter 11-sample window attenuates barometric/GPS altitude noise.
    smoothedAltitudeM: movingAverage(points.map(p => p.altitudeM), 11)
  };
}
