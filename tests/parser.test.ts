import { describe, expect, it } from "vitest";
import { parseTcx } from "../src/engine/parser/tcxParser";
import { sampleTcx } from "./sampleWorkout";
import { calculateWorkoutSummary } from "../src/engine/analytics/summary";

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
      .replace(/<Position>.*?<\/Position>/g, "")
      .replace(/<HeartRateBpm>.*?<\/HeartRateBpm>/g, "");
    const [workout] = parseTcx(gapped);
    expect(workout.dataQuality.timestampGapCount).toBeGreaterThan(0);
    expect(workout.dataQuality.missingGpsPercent).toBeGreaterThan(0);
    expect(workout.dataQuality.missingHeartRatePercent).toBeGreaterThan(0);
  });

  it("rejects malformed XML and empty activities", () => {
    expect(() => parseTcx("<broken")).toThrow(/invalid XML/i);
    expect(() => parseTcx("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities/></TrainingCenterDatabase>")).toThrow(/No Activity/i);
  });
  it("uses valid lap summary as official distance without stretching trackpoint or GPS distance", () => {
    const count = 111, duration = 3776, trackDistance = 5498, gpsDistance = 5503;
    const points = Array.from({ length: count }, (_, i) => {
      const fraction = i / (count - 1);
      const time = new Date(Date.parse("2026-01-01T06:00:00+05:30") + duration * 1000 * fraction).toISOString().replace("Z", "+00:00");
      const lat = 19 + 0.0495 * fraction;
      const dist = trackDistance * fraction;
      return `<Trackpoint><Time>${time}</Time><Position><LatitudeDegrees>${lat}</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>10</AltitudeMeters><DistanceMeters>${dist}</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>`;
    }).join("");
    const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-01-01T06:00:00+05:30</Id><Lap StartTime="2026-01-01T06:00:00+05:30"><TotalTimeSeconds>${duration}</TotalTimeSeconds><DistanceMeters>7006</DistanceMeters><Calories>300</Calories><Track>${points}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const [workout] = parseTcx(tcx, "16-11.tcx");
    expect(workout.distanceM).toBe(7006);
    expect(workout.lapSummaryDistanceM).toBe(7006);
    expect(workout.trackpointDistanceM).toBeCloseTo(trackDistance, 0);
    expect(workout.gpsDistanceM).toBeCloseTo(gpsDistance, 0);
    expect(workout.points.at(-1)?.distanceM).toBeCloseTo(trackDistance, 0);
    const summary = calculateWorkoutSummary(workout.points, duration, workout.distanceM, workout.calories);
    expect(summary.averagePaceSecPerKm).toBeCloseTo(3776 / 7.006, 1);
    expect(summary.averagePaceSecPerKm).toBeGreaterThan(538);
    expect(summary.averagePaceSecPerKm).toBeLessThan(540);
  });

  it("falls back to matching trackpoint distance when lap summary is missing or invalid", () => {
    const missing = sampleTcx.replace("<DistanceMeters>200</DistanceMeters><Calories>", "<DistanceMeters>0</DistanceMeters><Calories>");
    const [workout] = parseTcx(missing);
    expect(workout.lapSummaryDistanceM).toBeNull();
    expect(workout.distanceM).toBe(200);
    expect(workout.trackpointDistanceM).toBe(200);
  });

});
