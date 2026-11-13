import type { TrackPoint } from "./workout";

export interface WorkoutSummary {
  distanceM: number;
  elapsedSeconds: number;
  movingSeconds: number;
  stoppedSeconds: number;
  averagePaceSecPerKm: number | null;
  movingPaceSecPerKm: number | null;
  maxSpeedMps: number | null;
  averageHeartRateBpm: number | null;
  minHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  calories: number | null;
  elevationMinM: number | null;
  elevationMaxM: number | null;
  smoothedElevationGainM: number;
  smoothedElevationLossM: number;
}

export interface Split {
  index: number;
  distanceM: number;
  durationSeconds: number;
  paceSecPerKm: number | null;
  averageHeartRateBpm: number | null;
  partial: boolean;
}

export interface BestEffort {
  label: string;
  targetDistanceM?: number;
  targetDurationSeconds?: number;
  durationSeconds: number;
  paceSecPerKm: number;
  startDistanceM: number;
  endDistanceM: number;
}

export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  lowerBpm: number;
  upperBpm: number;
  seconds: number;
  percent: number;
}

export interface RunWalkBout {
  type: "run" | "walk" | "stopped";
  startTimeMs: number;
  endTimeMs: number;
  durationSeconds: number;
  distanceM: number;
  averageSpeedMps: number | null;
  averageHeartRateBpm: number | null;
}

export interface AnalyticsSeries {
  raw: TrackPoint[];
  smoothedSpeedMps: number[];
  smoothedPaceSecPerKm: number[];
  smoothedAltitudeM: Array<number | null>;
}
