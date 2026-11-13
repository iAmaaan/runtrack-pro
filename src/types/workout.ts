/** Canonical, unit-explicit workout types. All timestamps are epoch milliseconds. */
export interface TrackPoint {
  timeMs: number;
  /** Normalized distance from the beginning of the activity, metres. */
  distanceM: number | null;
  latitude: number | null;
  longitude: number | null;
  altitudeM: number | null;
  heartRateBpm: number | null;
  /** Derived from the best available distance signal, metres/second. */
  speedMps: number | null;
  lapIndex: number;
}

export interface LapSummary {
  index: number;
  startTimeMs: number | null;
  totalTimeSeconds: number | null;
  distanceMeters: number | null;
  calories: number | null;
  trackpointCount: number;
}

export type DataQualitySeverity = "info" | "warning" | "error";
export interface DataQualityIssue {
  code:
    | "TIMESTAMP_GAP"
    | "STOP_OR_AUTO_PAUSE"
    | "GPS_DRIFT"
    | "LAP_TRACK_DISTANCE_MISMATCH"
    | "MISSING_HEART_RATE"
    | "MISSING_GPS"
    | "INVALID_TRACKPOINT"
    | "ALTITUDE_NOISE";
  severity: DataQualitySeverity;
  message: string;
  count?: number;
  details?: Record<string, number | string | null>;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  timestampGapCount: number;
  stopPeriodCount: number;
  gpsDriftCount: number;
  lapSummaryDistanceM: number | null;
  trackpointDistanceM: number | null;
  distanceMismatchPercent: number | null;
  missingHeartRatePercent: number;
  missingGpsPercent: number;
}

export interface Workout {
  id: string;
  name: string;
  sport: string;
  startedAtMs: number;
  endedAtMs: number;
  /** Activity elapsed time from trackpoint timestamps, seconds. */
  elapsedSeconds: number;
  /** Sum of Lap/TotalTimeSeconds when available, otherwise elapsed time. */
  timerSeconds: number;
  lapSummaryDistanceM: number | null;
  trackpointDistanceM: number;
  calories: number | null;
  laps: LapSummary[];
  points: TrackPoint[];
  dataQuality: DataQualityReport;
  sourceFileName: string;
  parserVersion: 1;
}
