import type { TrackPoint } from "../../types/workout";

export interface CardiacDriftResult {
  firstHalfAverageHr: number | null;
  secondHalfAverageHr: number | null;
  firstHalfAverageSpeedMps: number | null;
  secondHalfAverageSpeedMps: number | null;
  driftPercent: number | null;
  aerobicDecouplingPercent: number | null;
  eligibleSeconds: number;
}
export interface HeartRateRecoveryResult {
  peakHeartRateBpm: number | null;
  heartRateAfter60SecondsBpm: number | null;
  recoveryBpm: number | null;
}
export interface TrainingLoadResult {
  trimp: number;
  durationMinutes: number;
  averageHeartRateBpm: number | null;
  intensityFactor: number | null;
}

/** HR-to-speed decoupling across the activity halves; interpret only steady aerobic sessions. */
export function calculateCardiacDrift(points: TrackPoint[]): CardiacDriftResult {
  const intervals = points.slice(1).map((b, i) => {
    const a = points[i], dt = (b.timeMs - a.timeMs) / 1000;
    return { hr: a.heartRateBpm, speed: b.speedMps, dt };
  }).filter(x => x.dt > 0 && x.dt <= 10 && x.hr !== null && x.speed !== null && x.speed > 0);
  const half = Math.floor(intervals.length / 2);
  const first = intervals.slice(0, half), second = intervals.slice(half);
  const weighted = (xs: typeof intervals, key: "hr" | "speed") => {
    const total = xs.reduce((s, x) => s + x.dt, 0);
    return total ? xs.reduce((s, x) => s + (x[key] as number) * x.dt, 0) / total : null;
  };
  const h1 = weighted(first, "hr"), h2 = weighted(second, "hr");
  const s1 = weighted(first, "speed"), s2 = weighted(second, "speed");
  const drift = h1 && h2 ? (h2 - h1) / h1 * 100 : null;
  const ef1 = h1 && s1 ? s1 / h1 : null, ef2 = h2 && s2 ? s2 / h2 : null;
  const decoupling = ef1 && ef2 ? (ef1 - ef2) / ef1 * 100 : null;
  return {
    firstHalfAverageHr: h1, secondHalfAverageHr: h2,
    firstHalfAverageSpeedMps: s1, secondHalfAverageSpeedMps: s2,
    driftPercent: drift, aerobicDecouplingPercent: decoupling,
    eligibleSeconds: intervals.reduce((s, x) => s + x.dt, 0)
  };
}

/** Finds the first valid sample at or after 60 seconds following the recorded peak. */
export function calculateHeartRateRecovery(points: TrackPoint[], recoverySeconds = 60): HeartRateRecoveryResult {
  const valid = points.filter(p => p.heartRateBpm !== null);
  if (!valid.length) return { peakHeartRateBpm: null, heartRateAfter60SecondsBpm: null, recoveryBpm: null };
  let peak = valid[0];
  for (const p of valid) if (p.heartRateBpm! > peak.heartRateBpm!) peak = p;
  const after = valid.find(p => p.timeMs >= peak.timeMs + recoverySeconds * 1000);
  const recovered = after?.heartRateBpm ?? null;
  return {
    peakHeartRateBpm: peak.heartRateBpm,
    heartRateAfter60SecondsBpm: recovered,
    recoveryBpm: recovered === null ? null : peak.heartRateBpm! - recovered
  };
}

/** Banister-style TRIMP estimate using sex-specific exponential weighting when supplied. */
export function calculateTrainingLoad(
  points: TrackPoint[], age: number, restingHr: number, maxHr?: number,
  sex: "male" | "female" = "male"
): TrainingLoadResult {
  const estimatedMax = maxHr ?? 220 - age;
  if (restingHr <= 0 || estimatedMax <= restingHr || estimatedMax > 230) {
    throw new Error("Heart-rate values are outside a valid range.");
  }
  let trimp = 0, weightedSeconds = 0, totalSeconds = 0, hrSeconds = 0;
  const gamma = sex === "male" ? 1.92 : 1.67;
  for (let i = 1; i < points.length; i++) {
    const hr = points[i - 1].heartRateBpm;
    const dt = (points[i].timeMs - points[i - 1].timeMs) / 1000;
    if (hr === null || dt <= 0 || dt > 10) continue;
    const reserve = Math.max(0, Math.min(1, (hr - restingHr) / (estimatedMax - restingHr)));
    const weight = 0.64 * Math.exp(gamma * reserve);
    trimp += (dt / 60) * reserve * weight;
    weightedSeconds += dt * reserve;
    hrSeconds += dt * hr;
    totalSeconds += dt;
  }
  const averageHr = totalSeconds ? hrSeconds / totalSeconds : null;
  const intensity = totalSeconds ? weightedSeconds / totalSeconds : null;
  return { trimp, durationMinutes: totalSeconds / 60, averageHeartRateBpm: averageHr, intensityFactor: intensity };
}
