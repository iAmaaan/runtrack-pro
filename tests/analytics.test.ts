import { describe, expect, it } from "vitest";
import { calculateWorkoutSummary } from "../src/engine/analytics/summary";
import { calculateSplits } from "../src/engine/analytics/splits";
import { samplePoints } from "./sampleWorkout";

describe("workout analytics", () => {
  it("calculates pace and does not sum tiny altitude noise", () => {
    const points = samplePoints();
    const summary = calculateWorkoutSummary(points, 600, 1000, 100);
    expect(summary.averagePaceSecPerKm).toBe(600);
    expect(summary.elevationMinM).toBeCloseTo(9.8, 1);
    expect(summary.smoothedElevationGainM).toBe(0);
  });

  it("creates exact kilometre splits", () => {
    const points = Array.from({ length: 26 }, (_, i) => ({
      timeMs: 1_700_000_000_000 + i * 40_000,
      distanceM: i * 40,
      latitude: null, longitude: null, altitudeM: null,
      heartRateBpm: 130, speedMps: 1, lapIndex: 0
    }));
    const splits = calculateSplits(points, 1000, 1000);
    expect(splits).toHaveLength(1);
    expect(splits[0].distanceM).toBe(1000);
    expect(splits[0].partial).toBe(false);
  });

  it("keeps a partial final split rather than dropping the remaining distance", () => {
    const points = Array.from({ length: 29 }, (_, i) => ({
      timeMs: 1_700_000_000_000 + i * 40_000,
      distanceM: i * 40,
      latitude: null, longitude: null, altitudeM: null,
      heartRateBpm: 130, speedMps: 1, lapIndex: 0
    }));
    const splits = calculateSplits(points, 1120, 1000);
    expect(splits).toHaveLength(2);
    expect(splits[0].distanceM).toBe(1000);
    expect(splits[0].partial).toBe(false);
    expect(splits[1].distanceM).toBe(120);
    expect(splits[1].partial).toBe(true);
  });
});
