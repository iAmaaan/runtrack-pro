import type { TrackPoint } from "../../types/workout";
import type { Split } from "../../types/analytics";

function interpolate(a: TrackPoint, b: TrackPoint, targetDistance: number): { timeMs: number; hr: number | null } {
  const span = (b.distanceM ?? 0) - (a.distanceM ?? 0);
  const fraction = span > 0 ? Math.max(0, Math.min(1, (targetDistance - (a.distanceM ?? 0)) / span)) : 0;
  const timeMs = a.timeMs + (b.timeMs - a.timeMs) * fraction;
  const hr = a.heartRateBpm !== null && b.heartRateBpm !== null
    ? a.heartRateBpm + (b.heartRateBpm - a.heartRateBpm) * fraction
    : (a.heartRateBpm ?? b.heartRateBpm);
  return { timeMs, hr };
}

/** Build exact-distance splits by interpolating at split boundaries; the last split may be partial. */
export function calculateSplits(points: TrackPoint[], totalDistanceM: number, splitDistanceM = 1000): Split[] {
  if (points.length < 2 || totalDistanceM <= 0 || splitDistanceM <= 0) return [];
  const valid = points.filter(p => p.distanceM !== null).sort((a, b) => a.distanceM! - b.distanceM!);
  if (valid.length < 2) return [];
  const startDistance = valid[0].distanceM!;
  const endDistance = Math.min(totalDistanceM + startDistance, valid[valid.length - 1].distanceM!);
  const boundaries = [startDistance];
  for (let d = startDistance + splitDistanceM; d < endDistance; d += splitDistanceM) boundaries.push(d);
  boundaries.push(endDistance);
  const at = (target: number) => {
    for (let i = 1; i < valid.length; i++) {
      if (valid[i].distanceM! >= target) return interpolate(valid[i - 1], valid[i], target);
    }
    const last = valid[valid.length - 1];
    return { timeMs: last.timeMs, hr: last.heartRateBpm };
  };
  const splits: Split[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const from = boundaries[i - 1], to = boundaries[i];
    if (to <= from) continue;
    const a = at(from), b = at(to), duration = (b.timeMs - a.timeMs) / 1000;
    if (duration <= 0) continue;
    const distance = to - from;
    const hrValues = valid.filter(p => p.distanceM! >= from && p.distanceM! <= to)
      .map(p => p.heartRateBpm).filter((v): v is number => v !== null);
    const edgeHrs = [a.hr, b.hr].filter((v): v is number => v !== null);
    const allHr = [...hrValues, ...edgeHrs];
    splits.push({
      index: splits.length + 1, distanceM: distance, durationSeconds: duration,
      paceSecPerKm: duration / (distance / 1000),
      averageHeartRateBpm: allHr.length ? allHr.reduce((s, v) => s + v, 0) / allHr.length : null,
      partial: distance < splitDistanceM - 0.01
    });
  }
  return splits;
}
