import type { TrackPoint } from "../src/types/workout";

export function samplePoints(): TrackPoint[] {
  return Array.from({ length: 11 }, (_, i) => ({
    timeMs: 1_700_000_000_000 + i * 60_000,
    distanceM: i * 100,
    latitude: 19 + i * 0.0001,
    longitude: 72,
    altitudeM: 10 + (i % 2 ? 0.2 : -0.2),
    heartRateBpm: 120 + i,
    speedMps: 100 / 60,
    lapIndex: 0
  }));
}

export const sampleTcx = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities><Activity Sport="Running"><Id>2026-01-01T06:00:00+05:30</Id>
    <Lap StartTime="2026-01-01T06:00:00+05:30">
      <TotalTimeSeconds>120</TotalTimeSeconds><DistanceMeters>200</DistanceMeters><Calories>20</Calories>
      <Track><Trackpoint><Time>2026-01-01T06:00:00+05:30</Time><Position><LatitudeDegrees>19</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>10</AltitudeMeters><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-01-01T06:01:00+05:30</Time><Position><LatitudeDegrees>19.001</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>10.2</AltitudeMeters><DistanceMeters>100</DistanceMeters><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-01-01T06:02:00+05:30</Time><Position><LatitudeDegrees>19.002</LatitudeDegrees><LongitudeDegrees>72</LongitudeDegrees></Position><AltitudeMeters>9.9</AltitudeMeters><DistanceMeters>200</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint></Track>
    </Lap></Activity></Activities>
</TrainingCenterDatabase>`;
