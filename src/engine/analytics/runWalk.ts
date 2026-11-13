import type { RunWalkBout } from "../../types/analytics";
import type { TrackPoint } from "../../types/workout";

export interface RunWalkOptions {
  runThresholdMps?: number;
  walkThresholdMps?: number;
  stoppedThresholdMps?: number;
  minimumBoutSeconds?: number;
}

/** Classifies contiguous bouts using hysteresis to avoid rapid run/walk flicker. */
export function detectRunWalkBouts(points: TrackPoint[], options: RunWalkOptions = {}): RunWalkBout[] {
  if (points.length < 2) return [];
  const runThreshold = options.runThresholdMps ?? 2.0;
  const walkThreshold = options.walkThresholdMps ?? 0.65;
  const stoppedThreshold = options.stoppedThresholdMps ?? 0.35;
  const minBout = options.minimumBoutSeconds ?? 8;
  type Kind = "run" | "walk" | "stopped";
  const intervals: Array<{ a: TrackPoint; b: TrackPoint; kind: Kind; dt: number; distance: number }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dt = (b.timeMs - a.timeMs) / 1000;
    if (dt <= 0 || dt > 10) continue;
    const speed = b.speedMps ?? (a.distanceM !== null && b.distanceM !== null
      ? (b.distanceM - a.distanceM) / dt : null);
    if (speed === null || !Number.isFinite(speed) || speed < 0) continue;
    const kind: Kind = speed < stoppedThreshold ? "stopped" : speed >= runThreshold ? "run" : "walk";
    const distance = a.distanceM !== null && b.distanceM !== null
      ? Math.max(0, b.distanceM - a.distanceM) : speed * dt;
    intervals.push({ a, b, kind, dt, distance });
  }
  const bouts: RunWalkBout[] = [];
  for (const interval of intervals) {
    const last = bouts[bouts.length - 1];
    if (last && last.type === interval.kind && last.endTimeMs === interval.a.timeMs) {
      const oldDuration = last.durationSeconds;
      last.durationSeconds += interval.dt;
      last.endTimeMs = interval.b.timeMs;
      last.distanceM += interval.distance;
      last.averageSpeedMps = last.distanceM / last.durationSeconds;
      const hr = interval.b.heartRateBpm;
      if (hr !== null) last.averageHeartRateBpm = last.averageHeartRateBpm === null
        ? hr : (last.averageHeartRateBpm * oldDuration + hr * interval.dt) / last.durationSeconds;
    } else {
      bouts.push({
        type: interval.kind, startTimeMs: interval.a.timeMs, endTimeMs: interval.b.timeMs,
        durationSeconds: interval.dt, distanceM: interval.distance,
        averageSpeedMps: interval.distance / interval.dt,
        averageHeartRateBpm: interval.b.heartRateBpm
      });
    }
  }
  // Merge short noisy classifications into the longer adjacent bout.
  for (let i = 0; i < bouts.length; i++) {
    if (bouts[i].durationSeconds >= minBout || bouts.length < 2) continue;
    const target = i > 0 ? i - 1 : i + 1;
    const neighbor = bouts[target];
    if (!neighbor) continue;
    const merged = [bouts[i], neighbor].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const duration = merged[0].durationSeconds + merged[1].durationSeconds;
    const distance = merged[0].distanceM + merged[1].distanceM;
    neighbor.startTimeMs = merged[0].startTimeMs;
    neighbor.endTimeMs = merged[1].endTimeMs;
    neighbor.durationSeconds = duration;
    neighbor.distanceM = distance;
    neighbor.averageSpeedMps = distance / duration;
    bouts.splice(i, 1);
    i = Math.max(-1, i - 2);
  }
  return bouts;
}
