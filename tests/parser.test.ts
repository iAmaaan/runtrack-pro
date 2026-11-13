import { describe, expect, it } from "vitest";
import { parseTcx } from "../src/engine/parser/tcxParser";
import { sampleTcx } from "./sampleWorkout";

describe("parseTcx", () => {
  it("parses namespaced TCX and preserves timezone offsets", () => {
    const [workout] = parseTcx(sampleTcx, "morning.tcx");
    expect(workout.name).toBe("morning");
    expect(workout.sport).toBe("Running");
    expect(new Date(workout.startedAtMs).toISOString()).toBe("2026-01-01T00:30:00.000Z");
    expect(workout.points).toHaveLength(3);
    expect(workout.trackpointDistanceM).toBe(200);
    expect(workout.calories).toBe(20);
  });

  it("reports lap-summary versus trackpoint distance mismatch", () => {
    const [workout] = parseTcx(sampleTcx.replace("<DistanceMeters>200</DistanceMeters><Calories>", "<DistanceMeters>196</DistanceMeters><Calories>"));
    expect(workout.dataQuality.distanceMismatchPercent).toBeCloseTo(2.04, 1);
    expect(workout.dataQuality.issues.some(x => x.code === "LAP_TRACK_DISTANCE_MISMATCH")).toBe(true);
  });

  it("rejects malformed XML and empty activities", () => {
    expect(() => parseTcx("<broken")).toThrow(/invalid XML/i);
    expect(() => parseTcx("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities/></TrainingCenterDatabase>")).toThrow(/No Activity/i);
  });
});
