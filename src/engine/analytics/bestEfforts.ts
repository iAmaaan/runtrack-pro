import type { BestEffort } from "../../types/analytics";
import type { TrackPoint } from "../../types/workout";

function interpolateTime(a: TrackPoint, b: TrackPoint, fraction: number): number {
  return a.timeMs + (b.timeMs - a.timeMs) * Math.max(0, Math.min(1, fraction));
}
function timeAtDistance(points: TrackPoint[], target: number): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.distanceM === null || b.distanceM === null || b.distanceM <= a.distanceM) continue;
    if (target >= a.distanceM && target <= b.distanceM) {
      return interpolateTime(a, b, (target - a.distanceM) / (b.distanceM - a.distanceM));
    }
  }
  return null;
}
function distanceAtTime(points: TrackPoint[], target: number): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (b.timeMs <= a.timeMs) continue;
    if (target >= a.timeMs && target <= b.timeMs) {
      if (a.distanceM === null || b.distanceM === null) return null;
      const f = (target - a.timeMs) / (b.timeMs - a.timeMs);
      return a.distanceM + (b.distanceM - a.distanceM) * f;
    }
  }
  return null;
}

/** Fastest continuous rolling efforts. GPS gaps and non-monotonic samples are skipped. */
export function calculateBestEfforts(points: TrackPoint[]): BestEffort[] {
  const valid = points.filter(p => Number.isFinite(p.timeMs) && p.distanceM !== null)
    .sort((a, b) => a.timeMs - b.timeMs);
  if (valid.length < 2) return [];
  const specs = [
    { label: "400 m", distance: 400 }, { label: "1 km", distance: 1000 },
    { label: "1 mile", distance: 1609.344 }, { label: "5 km", distance: 5000 }
  ];
  const results: BestEffort[] = [];
  for (const spec of specs) {
    let best: BestEffort | null = null;
    for (let i = 0; i < valid.length - 1; i++) {
      const start = valid[i].distanceM!;
      const endTime = timeAtDistance(valid, start + spec.distance);
      if (endTime === null) continue;
      const duration = (endTime - valid[i].timeMs) / 1000;
      if (duration <= 0 || duration > 24 * 60 * 60) continue;
      if (!best || duration < best.durationSeconds) best = {
        label: spec.label, targetDistanceM: spec.distance, durationSeconds: duration,
        paceSecPerKm: duration / (spec.distance / 1000),
        startDistanceM: start, endDistanceM: start + spec.distance
      };
    }
    if (best) results.push(best);
  }
  const timeSpecs = [
    { label: "1 min", seconds: 60 }, { label: "5 min", seconds: 300 },
    { label: "10 min", seconds: 600 }
  ];
  for (const spec of timeSpecs) {
    let best: BestEffort | null = null;
    for (const p of valid) {
      const endDistance = distanceAtTime(valid, p.timeMs + spec.seconds * 1000);
      if (endDistance === null || endDistance <= p.distanceM!) continue;
      const distance = endDistance - p.distanceM!;
      const effort: BestEffort = {
        label: spec.label, targetDurationSeconds: spec.seconds, durationSeconds: spec.seconds,
        paceSecPerKm: spec.seconds / (distance / 1000),
        startDistanceM: p.distanceM!, endDistanceM: endDistance
      };
      if (!best || effort.endDistanceM - effort.startDistanceM > best.endDistanceM - best.startDistanceM) best = effort;
    }
    if (best) results.push(best);
  }
  return results;
}
