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

type CategoryKey = keyof ContributionCategoryBreakdown;

/**
 * Spread `penalty` across non-zero category bases proportionally.
 * Weights use positive bases first; if none, absolute values of non-zero
 * bases; if still none, equal thirds.
 */
function applyPenaltyProportionally(
  taxes: number,
  charity: number,
  volunteer: number,
  penalty: number,
): ContributionCategoryBreakdown {
  if (penalty === 0) {
    return { taxes, charity, volunteer };
  }

  const entries: Array<{ key: CategoryKey; value: number }> = [
    { key: "taxes", value: taxes },
    { key: "charity", value: charity },
    { key: "volunteer", value: volunteer },
  ];

  let weights = entries
    .filter((e) => e.value > 0)
    .map((e) => ({ key: e.key, weight: e.value }));
  if (weights.length === 0) {
    weights = entries
      .filter((e) => e.value !== 0)
      .map((e) => ({ key: e.key, weight: Math.abs(e.value) }));
  }

  const next: ContributionCategoryBreakdown = { taxes, charity, volunteer };
  if (weights.length === 0) {
    const share = penalty / 3;
    next.taxes += share;
    next.charity += share;
    next.volunteer += share;
    return next;
  }

  const weightSum = weights.reduce((s, w) => s + w.weight, 0);
  for (const w of weights) {
    next[w.key] += penalty * (w.weight / weightSum);
  }
  return next;
}

/**
 * Civic ME-source buckets from ledger sources:
 * - tax_payment → taxes
 * - charitable_donation → charity
 * - volunteer_work + volunteer → volunteer
 * - penalty → split across non-zero buckets proportionally (may go negative)
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
  let penalty = 0;
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
        volunteer += me;
        break;
      case "penalty":
        penalty += me;
        break;
      default:
        break;
    }
  }

  if (!saw) return null;

  const allocated = applyPenaltyProportionally(
    taxes,
    charity,
    volunteer,
    penalty,
  );
  return {
    taxes: round2(allocated.taxes),
    charity: round2(allocated.charity),
    volunteer: round2(allocated.volunteer),
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
