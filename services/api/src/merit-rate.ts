import type { CivicSettings, WageBasis } from "@civic/shared";
import { RovasClient, RovasClientError } from "./rovas-client.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 60 * 1000;
const DEFAULT_COUNTRY = "SK";

export type ResolvedMeritRate = {
  country_code: string;
  hourly_wage_eur: number;
  merits_per_hour: number;
  wage_basis: WageBasis;
  formula_version: number;
  /** Where the hourly wage came from. */
  source: "rovas" | "fallback";
  rovas_source?: string;
  updated?: string | null;
};

type CacheEntry = {
  expiresAt: number;
  value: ResolvedMeritRate;
};

let cache: CacheEntry | null = null;

/**
 * Resolve the national hourly wage for Merit previews.
 * Prefers Rovas admin SoT; falls back to Civic env/settings when the
 * endpoint is missing or Rovas is unreachable.
 */
export async function resolveMeritRate(
  rovas: RovasClient,
  settings: CivicSettings,
  countryCode: string = DEFAULT_COUNTRY,
): Promise<ResolvedMeritRate> {
  const code = countryCode.toUpperCase();
  const now = Date.now();
  if (
    cache &&
    cache.expiresAt > now &&
    cache.value.country_code === code
  ) {
    return cache.value;
  }

  try {
    const remote = await rovas.fetchNationalHourlyRate(code);
    const value: ResolvedMeritRate = {
      country_code: remote.country_code,
      hourly_wage_eur: remote.hourly_wage_eur,
      merits_per_hour: remote.merits_per_hour ?? settings.meritsPerHour,
      wage_basis: settings.wageBasis,
      formula_version: settings.formulaVersion,
      source: "rovas",
      rovas_source: remote.source,
      updated: remote.updated,
    };
    cache = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  } catch (err) {
    // 404 = endpoint not deployed yet; other errors = transient.
    if (!(err instanceof RovasClientError)) {
      throw err;
    }
    const value: ResolvedMeritRate = {
      country_code: code,
      hourly_wage_eur: settings.hourlyWageEur,
      merits_per_hour: settings.meritsPerHour,
      wage_basis: settings.wageBasis,
      formula_version: settings.formulaVersion,
      source: "fallback",
      updated: null,
    };
    // Cache short misses so verify spam does not hammer a missing endpoint.
    cache = { expiresAt: now + FALLBACK_CACHE_TTL_MS, value };
    return value;
  }
}

/** Test / admin helper. */
export function clearMeritRateCache(): void {
  cache = null;
}
