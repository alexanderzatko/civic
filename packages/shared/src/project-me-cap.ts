import { displayMerits } from "./merits.js";
import type { UserLookupProjectRow } from "./types.js";

/**
 * When a category tab is smaller than the sum of attributed project rows
 * (typical after proportional Merit penalty), scale row ME so the **displayed**
 * whole-ME amounts sum to `displayMerits(categoryMe)`.
 *
 * Rovas `top_*` rows stay gross earned; Civic applies this for UI consistency
 * (see Rovas volunteer-tab-vs-top-projects → Civic follow-up).
 *
 * If `categoryMe >= sum(rows.me)`, rows are unchanged (e.g. unattributed
 * CHR→ME making the tab larger than the project list).
 */
export function capProjectRowsToCategory(
  rows: UserLookupProjectRow[],
  categoryMe: number,
): UserLookupProjectRow[] {
  if (rows.length === 0) return rows;

  const weights = rows.map((r) => {
    const me = Number(r.me);
    return Number.isFinite(me) && me > 0 ? me : 0;
  });
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!(sum > 0)) return rows;

  const cap = Number(categoryMe);
  if (!Number.isFinite(cap) || cap >= sum) return rows;

  const capDisplay = displayMerits(cap);
  if (capDisplay <= 0) {
    return rows.map((r) => ({ ...r, me: 0 }));
  }

  // Largest-remainder allocation of whole displayed ME.
  const exact = weights.map((w) => (w / sum) * capDisplay);
  const floors = exact.map((x) => Math.floor(x));
  let rem = capDisplay - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i], weight: weights[i]! }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight || a.i - b.i);

  const allocated = floors.slice();
  for (const { i } of order) {
    if (rem <= 0) break;
    allocated[i]! += 1;
    rem -= 1;
  }

  return rows.map((r, i) => ({ ...r, me: allocated[i]! }));
}
