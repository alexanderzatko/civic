/**
 * Civic runtime settings — Merit conversion and fraud defaults.
 *
 * Override via environment variables (see .env.example). Values here are the
 * documented v1 defaults used when env is unset.
 *
 * Hourly wage: prefer Rovas admin national rate
 * (`GET /rovas/civic_national_hourly_rate`). `HOURLY_WAGE_EUR` / the default
 * below are **fallback only** when that endpoint is unavailable.
 *
 * Wage basis: **net** hourly EUR (Civic-side label; Rovas owns the rate).
 */

export type WageBasis = "net" | "gross";

export interface CivicSettings {
  /** Net (or gross) hourly wage used in Merit conversion. */
  hourlyWageEur: number;
  /** Always "net" for v1 — open decision closed 2026-08. */
  wageBasis: WageBasis;
  /** Bump when wage or formula changes; persisted on each claim. */
  formulaVersion: number;
  /** Rovas convention: 10 ME = 1 hour. */
  meritsPerHour: number;
  /** Reject claims with VAT below this (EUR). */
  minVatEur: number;
  /** Days after purchase_at during which a receipt may be claimed. */
  claimWindowDays: number;
  claimRateLimitDay: number;
  claimRateLimitMonth: number;
  strikeThreshold: number;
  strikeWindowDays: number;
  maxGroundSpeedKmh: number;
  locationBufferKm: number;
  merchantProximityKm: number;
  minDeltaTHours: number;
  maxLocationAccuracyM: number;
}

/** Documented v1 defaults — keep in sync with .env.example comments. */
export const DEFAULT_SETTINGS: CivicSettings = {
  hourlyWageEur: 7.5,
  wageBasis: "net",
  formulaVersion: 1,
  meritsPerHour: 10,
  minVatEur: 0.01,
  claimWindowDays: 30,
  claimRateLimitDay: 20,
  claimRateLimitMonth: 200,
  strikeThreshold: 3,
  strikeWindowDays: 30,
  maxGroundSpeedKmh: 100,
  locationBufferKm: 25,
  merchantProximityKm: 50,
  minDeltaTHours: 0.25,
  maxLocationAccuracyM: 500,
};

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve settings from process.env, falling back to DEFAULT_SETTINGS.
 * Safe to call from Node (API). Mobile should import DEFAULT_SETTINGS or
 * receive values from the API preview response.
 */
export function loadSettings(
  env: NodeJS.ProcessEnv = process.env,
): CivicSettings {
  const basis = (env.WAGE_BASIS ?? DEFAULT_SETTINGS.wageBasis) as WageBasis;
  return {
    hourlyWageEur: envNumber("HOURLY_WAGE_EUR", DEFAULT_SETTINGS.hourlyWageEur),
    wageBasis: basis === "gross" ? "gross" : "net",
    formulaVersion: envNumber("FORMULA_VERSION", DEFAULT_SETTINGS.formulaVersion),
    meritsPerHour: DEFAULT_SETTINGS.meritsPerHour,
    minVatEur: envNumber("MIN_VAT_EUR", DEFAULT_SETTINGS.minVatEur),
    claimWindowDays: envNumber("CLAIM_WINDOW_DAYS", DEFAULT_SETTINGS.claimWindowDays),
    claimRateLimitDay: envNumber(
      "CLAIM_RATE_LIMIT_DAY",
      DEFAULT_SETTINGS.claimRateLimitDay,
    ),
    claimRateLimitMonth: envNumber(
      "CLAIM_RATE_LIMIT_MONTH",
      DEFAULT_SETTINGS.claimRateLimitMonth,
    ),
    strikeThreshold: envNumber("STRIKE_THRESHOLD", DEFAULT_SETTINGS.strikeThreshold),
    strikeWindowDays: envNumber(
      "STRIKE_WINDOW_DAYS",
      DEFAULT_SETTINGS.strikeWindowDays,
    ),
    maxGroundSpeedKmh: envNumber(
      "MAX_GROUND_SPEED_KMH",
      DEFAULT_SETTINGS.maxGroundSpeedKmh,
    ),
    locationBufferKm: envNumber(
      "LOCATION_BUFFER_KM",
      DEFAULT_SETTINGS.locationBufferKm,
    ),
    merchantProximityKm: envNumber(
      "MERCHANT_PROXIMITY_KM",
      DEFAULT_SETTINGS.merchantProximityKm,
    ),
    minDeltaTHours: envNumber(
      "MIN_DELTA_T_HOURS",
      DEFAULT_SETTINGS.minDeltaTHours,
    ),
    maxLocationAccuracyM: envNumber(
      "MAX_LOCATION_ACCURACY_M",
      DEFAULT_SETTINGS.maxLocationAccuracyM,
    ),
  };
}
