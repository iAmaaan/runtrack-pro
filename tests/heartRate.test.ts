import { describe, expect, it } from "vitest";
import { calculateHeartRateZones, estimateMaxHeartRate } from "../src/engine/analytics/heartRate";
import { samplePoints } from "./sampleWorkout";

describe("heart-rate zones", () => {
  it("uses 220 minus age unless a measured max is provided", () => {
    expect(estimateMaxHeartRate(26)).toBe(194);
    expect(estimateMaxHeartRate(26, 188)).toBe(188);
  });
  it("allocates interval time to five HR zones", () => {
    const zones = calculateHeartRateZones(samplePoints(), 26);
    expect(zones).toHaveLength(5);
    expect(zones.reduce((sum, zone) => sum + zone.seconds, 0)).toBe(600);
    expect(zones.reduce((sum, zone) => sum + zone.percent, 0)).toBeCloseTo(100);
  });
});
