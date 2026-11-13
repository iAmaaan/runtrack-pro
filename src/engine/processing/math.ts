import type { TrackPoint } from "../../types/workout";

export const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two WGS84 latitude/longitude positions. */
export function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const rad = (deg: number) => deg * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function isValidCoordinate(lat: number | null, lon: number | null): boolean {
  return lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Centred moving average; edge windows shrink rather than padding with fake samples. */
export function movingAverage(values: Array<number | null>, windowSize: number): Array<number | null> {
  const width = Math.max(1, Math.floor(windowSize));
  const left = Math.floor((width - 1) / 2);
  const right = Math.ceil((width - 1) / 2);
  return values.map((value, index) => {
    if (value === null || !Number.isFinite(value)) return null;
    const slice = values.slice(Math.max(0, index - left), Math.min(values.length, index + right + 1))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return slice.length ? slice.reduce((sum, v) => sum + v, 0) / slice.length : null;
  });
}

export function average(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pointGpsDistance(a: TrackPoint, b: TrackPoint): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  if (!isValidCoordinate(a.latitude, a.longitude) || !isValidCoordinate(b.latitude, b.longitude)) return null;
  return haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
}
