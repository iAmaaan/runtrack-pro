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

  it("normalizes distance across multiple laps, including lap counter resets", () => {
    const secondLap = `<Lap StartTime="2026-01-01T06:02:01+05:30"><TotalTimeSeconds>59</TotalTimeSeconds><DistanceMeters>100</DistanceMeters><Calories>10</Calories><Track><Trackpoint><Time>2026-01-01T06:02:01+05:30</Time><Position><LatitudeDegrees>19.002</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>10</AltitudeMeters><DistanceMeters>0</DistanceMeters></Trackpoint><Trackpoint><Time>2026-01-01T06:03:00+05:30</Time><Position><LatitudeDegrees>19.003</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>10</AltitudeMeters><DistanceMeters>100</DistanceMeters></Trackpoint></Track></Lap>`;
    const [workout] = parseTcx(sampleTcx.replace("</Lap></Activity>", "</Lap>" + secondLap + "</Activity>"));
    expect(workout.laps).toHaveLength(2);
    expect(workout.trackpointDistanceM).toBe(300);
    expect(workout.lapSummaryDistanceM).toBe(300);
  });

  it("detects long timestamp gaps and missing sensor/GPS fields", () => {
    const gapped = sampleTcx.replace("06:01:00+05:30", "06:01:10+05:30")
      .replace(/<Position>.*?<\\/Position>/g, "")
      .replace(/<HeartRateBpm>.*?<\\/HeartRateBpm>/g, "");
    const [workout] = parseTcx(gapped);
    expect(workout.dataQuality.timestampGapCount).toBeGreaterThan(0);
    expect(workout.dataQuality.missingGpsPercent).toBeGreaterThan(0);
    expect(workout.dataQuality.missingHeartRatePercent).toBeGreaterThan(0);
  });

  it("rejects malformed XML and empty activities", () => {
    expect(() => parseTcx("<broken")).toThrow(/invalid XML/i);
    expect(() => parseTcx("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities/></TrainingCenterDatabase>")).toThrow(/No Activity/i);
  });
});
