import { describe, expect, it } from "vitest";
import { calculateBestEfforts } from "../src/engine/analytics/bestEfforts";
import { detectRunWalkBouts } from "../src/engine/analytics/runWalk";
import { calculateCardiacDrift, calculateHeartRateRecovery, calculateTrainingLoad } from "../src/engine/analytics/trainingLoad";
import type { TrackPoint } from "../src/types/workout";

function points(count: number, seconds: number, speed: number, hr: number): TrackPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timeMs: 1_700_000_000_000 + i * seconds * 1000,
    distanceM: i * seconds * speed,
    latitude: null, longitude: null, altitudeM: null,
    heartRateBpm: hr, speedMps: speed, lapIndex: 0
  }));
}

describe("advanced running analytics", () => {
  it("finds rolling distance and duration best efforts", () => {
    const result = calculateBestEfforts(points(701, 1, 3, 150));
    expect(result.find(x => x.label === "400 m")?.durationSeconds).toBeCloseTo(400 / 3, 1);
    expect(result.find(x => x.label === "5 min")?.endDistanceM! - result.find(x => x.label === "5 min")?.startDistanceM!).toBeCloseTo(900, 1);
  });
  it("groups running and walking bouts", () => {
    const mixed = [
      ...points(12, 1, 2.8, 140),
      ...points(12, 1, 1.2, 125).map((p, i) => ({ ...p, timeMs: 1_700_000_011_000 + i * 1000, distanceM: 33.6 + i * 1.2 }))
    ];
    const bouts = detectRunWalkBouts(mixed);
    expect(bouts.some(x => x.type === "run")).toBe(true);
    expect(bouts.some(x => x.type === "walk")).toBe(true);
  });
  it("calculates HR recovery and TRIMP without inventing missing data", () => {
    const samples = points(121, 1, 0, 150).map((p, i) => ({ ...p, speedMps: 0, heartRateBpm: i < 10 ? 170 : 170 - Math.floor((i - 10) / 3) }));
    const recovery = calculateHeartRateRecovery(samples);
    expect(recovery.recoveryBpm).toBeGreaterThan(0);
    expect(calculateTrainingLoad(samples, 26, 60).trimp).toBeGreaterThan(0);
  });
  it("reports cardiac drift only when sufficient HR and speed data exist", () => {
    const steady = points(120, 5, 2.5, 140).map((p, i) => ({ ...p, heartRateBpm: i < 60 ? 140 : 150 }));
    expect(calculateCardiacDrift(steady).driftPercent).toBeGreaterThan(0);
    expect(calculateCardiacDrift([]).driftPercent).toBeNull();
  });
});
