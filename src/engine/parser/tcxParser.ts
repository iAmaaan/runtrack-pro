import type {
  DataQualityIssue, DataQualityReport, LapSummary, TrackPoint, Workout
} from "../../types/workout";
import { haversineMeters, isValidCoordinate } from "../processing/math";

const TCX_NS = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";
const numberOrNull = (value: string | null | undefined): number | null => {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const descendants = (element: Element, localName: string): Element[] =>
  Array.from(element.getElementsByTagNameNS("*", localName));
const childText = (element: Element, localName: string): string | null => {
  const child = descendants(element, localName)[0];
  return child?.textContent?.trim() || null;
};
const parseTime = (value: string | null): number | null => {
  if (!value) return null;
  // Date.parse honours the explicit ISO-8601 offset (e.g. +05:30); do not strip it.
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};
const makeId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `workout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

interface RawPoint {
  timeMs: number; distanceM: number | null; latitude: number | null;
  longitude: number | null; altitudeM: number | null; heartRateBpm: number | null;
  lapIndex: number;
}

function readTrackpoint(node: Element, lapIndex: number): RawPoint | null {
  const timeMs = parseTime(childText(node, "Time"));
  if (timeMs === null) return null;
  const lat = numberOrNull(childText(node, "LatitudeDegrees"));
  const lon = numberOrNull(childText(node, "LongitudeDegrees"));
  const latitude = lat !== null && Math.abs(lat) <= 90 ? lat : null;
  const longitude = lon !== null && Math.abs(lon) <= 180 ? lon : null;
  const hrNode = descendants(node, "HeartRateBpm")[0];
  const hr = hrNode ? numberOrNull(childText(hrNode, "Value")) : null;
  return {
    timeMs,
    distanceM: numberOrNull(childText(node, "DistanceMeters")),
    latitude, longitude,
    altitudeM: numberOrNull(childText(node, "AltitudeMeters")),
    heartRateBpm: hr !== null && hr >= 30 && hr <= 240 ? hr : null,
    lapIndex
  };
}

function readLaps(activity: Element): { laps: LapSummary[]; rawPoints: RawPoint[] } {
  const lapNodes = descendants(activity, "Lap").filter(node => {
    // A Lap nested inside Activity is selected; Trackpoints are read only from that lap.
    return node.parentElement === activity || node.parentElement?.localName === "Lap";
  });
  const uniqueLaps = lapNodes.filter((node, i) => lapNodes.indexOf(node) === i);
  const laps: LapSummary[] = [];
  const rawPoints: RawPoint[] = [];
  uniqueLaps.forEach((lap, index) => {
    const startTimeMs = parseTime(lap.getAttribute("StartTime"));
    const trackpoints = descendants(lap, "Trackpoint");
    const valid = trackpoints.map(node => readTrackpoint(node, index)).filter((p): p is RawPoint => p !== null);
    laps.push({
      index,
      startTimeMs,
      totalTimeSeconds: numberOrNull(childText(lap, "TotalTimeSeconds")),
      distanceMeters: numberOrNull(childText(lap, "DistanceMeters")),
      calories: numberOrNull(childText(lap, "Calories")),
      trackpointCount: valid.length
    });
    rawPoints.push(...valid);
  });
  return { laps, rawPoints };
}

function normalizeDistance(raw: RawPoint[]): TrackPoint[] {
  const points: TrackPoint[] = [];
  let lapOffset = 0;
  let previousLap = -1;
  let previousRaw: number | null = null;
  let previousNormalized = 0;
  for (const point of raw) {
    if (point.lapIndex !== previousLap) {
      if (previousLap !== -1) lapOffset = previousNormalized;
      previousLap = point.lapIndex;
      previousRaw = point.distanceM;
    }
    let distanceM: number | null = point.distanceM;
    if (distanceM !== null && previousRaw !== null) {
      distanceM = lapOffset + Math.max(0, distanceM - previousRaw);
      previousNormalized = Math.max(previousNormalized, distanceM);
    } else if (distanceM !== null) {
      distanceM = lapOffset + distanceM;
      previousNormalized = Math.max(previousNormalized, distanceM);
    }
    points.push({ ...point, distanceM, speedMps: null });
  }
  return points;
}

function buildQuality(points: TrackPoint[], laps: LapSummary[], trackDistanceM: number): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  let gaps = 0, stops = 0, drift = 0, inStop = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dt = (b.timeMs - a.timeMs) / 1000;
    if (dt > 1.5) gaps++;
    if (dt <= 0) { inStop = false; continue; }
    const counterDelta = a.distanceM !== null && b.distanceM !== null ? b.distanceM - a.distanceM : null;
    const gpsDelta = isValidCoordinate(a.latitude, a.longitude) && isValidCoordinate(b.latitude, b.longitude)
      ? haversineMeters(a.latitude!, a.longitude!, b.latitude!, b.longitude!) : null;
    if (counterDelta !== null && counterDelta <= 0 && gpsDelta !== null && gpsDelta > 3) drift++;
    const observedDistance = counterDelta !== null && counterDelta > 0 ? counterDelta : (gpsDelta ?? 0);
    const lowSpeed = observedDistance / dt < 0.5 && dt <= 10;
    if (lowSpeed && !inStop) stops++;
    inStop = lowSpeed;
  }
  const lapDistance = laps.every(l => l.distanceMeters !== null)
    ? laps.reduce((sum, lap) => sum + (lap.distanceMeters ?? 0), 0) : null;
  const mismatch = lapDistance !== null && lapDistance > 0
    ? Math.abs(trackDistanceM - lapDistance) / lapDistance * 100 : null;
  if (gaps) issues.push({ code: "TIMESTAMP_GAP", severity: "warning", count: gaps, message: `${gaps} timestamp gap(s) longer than 1.5 seconds were found.` });
  if (stops) issues.push({ code: "STOP_OR_AUTO_PAUSE", severity: "info", count: stops, message: `${stops} low-speed interval(s) were detected; these are candidates, not confirmed auto-pauses.` });
  if (drift) issues.push({ code: "GPS_DRIFT", severity: "warning", count: drift, message: `${drift} interval(s) show GPS movement while the distance counter is frozen.` });
  if (mismatch !== null && mismatch > 1) issues.push({
    code: "LAP_TRACK_DISTANCE_MISMATCH", severity: "warning",
    message: `Lap summary and trackpoint distance differ by ${mismatch.toFixed(2)}%.`,
    details: { lapSummaryDistanceM: lapDistance, trackpointDistanceM: trackDistanceM, mismatchPercent: mismatch }
  });
  const hrMissing = points.filter(p => p.heartRateBpm === null).length;
  const gpsMissing = points.filter(p => !isValidCoordinate(p.latitude, p.longitude)).length;
  const hrPercent = points.length ? hrMissing / points.length * 100 : 100;
  const gpsPercent = points.length ? gpsMissing / points.length * 100 : 100;
  if (hrPercent > 0) issues.push({ code: "MISSING_HEART_RATE", severity: "info", count: hrMissing, message: `${hrPercent.toFixed(1)}% of trackpoints have no valid heart rate.` });
  if (gpsPercent > 0) issues.push({ code: "MISSING_GPS", severity: "info", count: gpsMissing, message: `${gpsPercent.toFixed(1)}% of trackpoints have no valid GPS coordinates.` });
  return {
    issues, timestampGapCount: gaps, stopPeriodCount: stops, gpsDriftCount: drift,
    lapSummaryDistanceM: lapDistance, trackpointDistanceM: trackDistanceM,
    distanceMismatchPercent: mismatch, missingHeartRatePercent: hrPercent, missingGpsPercent: gpsPercent
  };
}

/** Parse a Garmin/Fitbit TCX document entirely in memory. No network or server upload. */
export function parseTcx(xmlText: string, sourceFileName = "activity.tcx"): Workout[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("The TCX file contains invalid XML.");
  const root = doc.documentElement;
  if (!root || (root.namespaceURI !== TCX_NS && !root.localName.includes("TrainingCenterDatabase"))) {
    throw new Error("This does not look like a Garmin Training Center Database TCX file.");
  }
  const activities = descendants(root, "Activity");
  if (!activities.length) throw new Error("No Activity entries were found in this TCX file.");
  const workouts: Workout[] = [];
  activities.forEach((activity, activityIndex) => {
    const { laps, rawPoints } = readLaps(activity);
    if (!rawPoints.length) return;
    rawPoints.sort((a, b) => a.timeMs - b.timeMs);
    const deduped = rawPoints.filter((p, i) => i === 0 || p.timeMs > rawPoints[i - 1].timeMs);
    const points = normalizeDistance(deduped);
    // Derive missing/flat counter intervals from GPS only when the counter is unavailable or frozen.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dt = (b.timeMs - a.timeMs) / 1000;
      if (dt <= 0) continue;
      const counterDelta = a.distanceM !== null && b.distanceM !== null ? b.distanceM - a.distanceM : null;
      const gpsDelta = isValidCoordinate(a.latitude, a.longitude) && isValidCoordinate(b.latitude, b.longitude)
        ? haversineMeters(a.latitude!, a.longitude!, b.latitude!, b.longitude!) : null;
      const delta = counterDelta !== null && counterDelta > 0 ? counterDelta : (gpsDelta ?? 0);
      b.speedMps = delta / dt;
    }
    const start = points[0].timeMs, end = points[points.length - 1].timeMs;
    const trackDistance = points.reduce((max, p) => Math.max(max, p.distanceM ?? 0), 0);
    const summaryDistance = laps.every(l => l.distanceMeters !== null)
      ? laps.reduce((sum, l) => sum + (l.distanceMeters ?? 0), 0) : null;
    const timerSeconds = laps.every(l => l.totalTimeSeconds !== null)
      ? laps.reduce((sum, l) => sum + (l.totalTimeSeconds ?? 0), 0) : (end - start) / 1000;
    const calories = laps.some(l => l.calories !== null)
      ? laps.reduce((sum, l) => sum + (l.calories ?? 0), 0) : null;
    const dataQuality = buildQuality(points, laps, trackDistance);
    workouts.push({
      id: makeId(), name: sourceFileName.replace(/\.tcx$/i, "") + (activities.length > 1 ? ` #${activityIndex + 1}` : ""),
      sport: activity.getAttribute("Sport") || "Unknown",
      startedAtMs: start, endedAtMs: end, elapsedSeconds: (end - start) / 1000,
      timerSeconds, lapSummaryDistanceM: summaryDistance, trackpointDistanceM: trackDistance,
      calories, laps, points, dataQuality, sourceFileName, parserVersion: 1
    });
  });
  if (!workouts.length) throw new Error("Activities were found, but none contained valid timestamped trackpoints.");
  return workouts;
}
