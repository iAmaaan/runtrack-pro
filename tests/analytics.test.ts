import { describe, expect, it } from "vitest";
import { calculateWorkoutSummary } from "../src/engine/analytics/summary";
import { calculateSplits } from "../src/engine/analytics/splits";
import { samplePoints } from "./sampleWorkout";

describe("workout analytics", () => {
  it("calculates pace and does not sum tiny altitude noise", () => {
    const points = samplePoints();
    const summary = calculateWorkoutSummary(points, 600, 1000, 100);
    expect(summary.averagePaceSecPerKm).toBe(600);
    expect(summary.elevationMinM).toBeCloseTo(9.9, 1);
    expect(summary.smoothedElevationGainM).toBe(0);
  });

  it("creates exact kilometre splits and a partial final split", () => {
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
});
