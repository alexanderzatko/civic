import { round2 } from "./merits.js";
import type { ContributionCategoryBreakdown } from "./types.js";

/**
 * Ledger `field_merit_source` keys from Rovas (`by_source` / `merit_source`).
 * Unknown keys are ignored when deriving Civic category buckets.
 */
export type MeritSourceKey =
  | "volunteer_work"
  | "volunteer"
  | "tax_payment"
  | "charitable_donation"
  | "penalty";

/** Sparse map from Rovas; zero keys omitted; `penalty` may be negative. */
export type MeritSourceBreakdown = Partial<Record<MeritSourceKey, number>> &
  Record<string, number>;

/**
 * Civic ME-source buckets from ledger sources:
 * - tax_payment → taxes
 * - charitable_donation → charity
 * - volunteer_work + volunteer + penalty → volunteer
 *
 * Returns `null` when `by_source` is missing/empty so callers can fall back to
 * Rovas `by_category`.
 */
export function categoriesFromMeritSources(
  bySource: MeritSourceBreakdown | null | undefined,
): ContributionCategoryBreakdown | null {
  if (!bySource || typeof bySource !== "object") return null;

  let taxes = 0;
  let charity = 0;
  let volunteer = 0;
  let saw = false;

  for (const [source, raw] of Object.entries(bySource)) {
    const me = Number(raw);
    if (!Number.isFinite(me)) continue;
    saw = true;
    switch (source) {
      case "tax_payment":
        taxes += me;
        break;
      case "charitable_donation":
        charity += me;
        break;
      case "volunteer_work":
      case "volunteer":
      case "penalty":
        volunteer += me;
        break;
      default:
        break;
    }
  }

  if (!saw) return null;
  return {
    taxes: round2(taxes),
    charity: round2(charity),
    volunteer: round2(volunteer),
  };
}

/** Prefer source-derived buckets; otherwise normalize Rovas `by_category`. */
export function resolveContributionCategories(
  byCategory: Partial<ContributionCategoryBreakdown> | null | undefined,
  bySource?: MeritSourceBreakdown | null,
): ContributionCategoryBreakdown {
  const fromSource = categoriesFromMeritSources(bySource ?? undefined);
  if (fromSource) return fromSource;
  return {
    taxes: Number(byCategory?.taxes) || 0,
    charity: Number(byCategory?.charity) || 0,
    volunteer: Number(byCategory?.volunteer) || 0,
  };
}
