import type { RankBucket, RankDistribution } from "./types.js";

/**
 * Approximate community percentile (0–100) from log-scale Merit buckets.
 * Uses `bin_edges_log10` when present; otherwise falls back to cumulative
 * bucket counts with the user's bucket index.
 */
export function percentileFromDistribution(
  distribution: RankDistribution,
  userMe?: number,
): number | null {
  const me =
    typeof userMe === "number"
      ? userMe
      : typeof distribution.user_merits === "number"
        ? distribution.user_merits
        : null;
  if (me === null || me < 0) return null;

  const total = histogramPopulation(distribution);
  if (total <= 0) return null;

  const edges = distribution.bin_edges_log10;
  if (edges && edges.length === distribution.buckets.length + 1) {
    return percentileFromLogEdges(me, distribution.buckets, edges, total);
  }

  const idx = distribution.user_bucket_index;
  if (typeof idx !== "number" || idx < 0) return null;
  let cumulative = 0;
  for (let i = 0; i < idx && i < distribution.buckets.length; i++) {
    cumulative += distribution.buckets[i]!.count;
  }
  const inBucket = distribution.buckets[idx]?.count ?? 0;
  return ((cumulative + inBucket * 0.5) / total) * 100;
}

/** Inverse of percentileFromDistribution — ME at a community percentile. */
export function meFromPercentile(
  distribution: RankDistribution,
  percentile: number,
): number | null {
  const total = histogramPopulation(distribution);
  const edges = distribution.bin_edges_log10;
  if (
    total <= 0 ||
    !edges ||
    edges.length !== distribution.buckets.length + 1
  ) {
    return null;
  }

  const clamped = Math.min(100, Math.max(0, percentile));
  const targetRank = (clamped / 100) * total;
  let cumulative = 0;

  for (let i = 0; i < distribution.buckets.length; i++) {
    const count = distribution.buckets[i]!.count;
    const next = cumulative + count;
    if (next >= targetRank || i === distribution.buckets.length - 1) {
      const lo = edges[i]!;
      const hi = edges[i + 1]!;
      const frac = count > 0 ? (targetRank - cumulative) / count : 0.5;
      const clampedFrac = Math.min(1, Math.max(0, frac));
      return Math.pow(10, lo + clampedFrac * (hi - lo));
    }
    cumulative = next;
  }
  return Math.pow(10, edges[edges.length - 1]!);
}

/** Bucket index for a Merit balance using log10 edges. */
export function bucketIndexForMe(
  distribution: RankDistribution,
  me: number,
): number {
  const edges = distribution.bin_edges_log10;
  if (!edges || edges.length !== distribution.buckets.length + 1) {
    return typeof distribution.user_bucket_index === "number"
      ? distribution.user_bucket_index
      : 0;
  }
  if (me <= 0) return 0;
  const logMe = Math.log10(Math.max(me, Number.MIN_VALUE));
  for (let i = 0; i < distribution.buckets.length; i++) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    if (logMe < lo) return Math.max(0, i - 1);
    if (logMe <= hi || i === distribution.buckets.length - 1) return i;
  }
  return distribution.buckets.length - 1;
}

/**
 * Ladder position (0–100) aligned with equal-width histogram columns.
 * Band boundaries fall at i/n · 100% so the runner lines up with the chart.
 * Distinct from {@link percentileFromDistribution} (people-weighted).
 */
export function sliderPositionFromMe(
  distribution: RankDistribution,
  userMe?: number,
): number | null {
  const me =
    typeof userMe === "number"
      ? userMe
      : typeof distribution.user_merits === "number"
        ? distribution.user_merits
        : null;
  if (me === null || me < 0) return null;

  const n = distribution.buckets.length;
  if (n <= 0) return null;

  const edges = distribution.bin_edges_log10;
  if (edges && edges.length === n + 1) {
    if (me <= 0) return 0;
    const logMe = Math.log10(Math.max(me, Number.MIN_VALUE));
    for (let i = 0; i < n; i++) {
      const lo = edges[i]!;
      const hi = edges[i + 1]!;
      if (logMe < lo) return (i / n) * 100;
      if (logMe <= hi || i === n - 1) {
        const frac =
          hi === lo ? 0.5 : Math.min(1, Math.max(0, (logMe - lo) / (hi - lo)));
        return ((i + frac) / n) * 100;
      }
    }
    return 100;
  }

  const idx = distribution.user_bucket_index;
  if (typeof idx !== "number" || idx < 0) return null;
  return ((idx + 0.5) / n) * 100;
}

/** Which equal-width band a ladder position falls into. */
export function bucketIndexFromSlider(
  distribution: RankDistribution,
  sliderPct: number,
): number {
  const n = distribution.buckets.length;
  if (n <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, sliderPct));
  if (clamped >= 100) return n - 1;
  return Math.min(n - 1, Math.floor((clamped / 100) * n));
}

/** ME at a geometric ladder position (equal band widths). */
export function meFromSliderPosition(
  distribution: RankDistribution,
  sliderPct: number,
): number | null {
  const n = distribution.buckets.length;
  const edges = distribution.bin_edges_log10;
  if (!edges || edges.length !== n + 1 || n <= 0) return null;

  const clamped = Math.min(100, Math.max(0, sliderPct));
  const continuous = (clamped / 100) * n;
  const i = Math.min(n - 1, Math.floor(continuous));
  const frac = clamped >= 100 ? 1 : continuous - i;
  const lo = edges[i]!;
  const hi = edges[i + 1]!;
  return Math.pow(10, lo + Math.min(1, Math.max(0, frac)) * (hi - lo));
}

/** Human-readable band label from log10 edges. */
export function spelledBucketLabel(
  distribution: RankDistribution,
  index: number,
  locale = "sk-SK",
): string | null {
  const edges = distribution.bin_edges_log10;
  if (
    !edges ||
    index < 0 ||
    index >= distribution.buckets.length ||
    edges.length !== distribution.buckets.length + 1
  ) {
    return distribution.buckets[index]?.label ?? null;
  }
  const lo = Math.pow(10, edges[index]!);
  const hi = Math.pow(10, edges[index + 1]!);
  const isLast = index === distribution.buckets.length - 1;
  const en = locale.toLowerCase().startsWith("en");
  const unit = en ? "Merits" : "meritov";
  if (lo < 1e-9) {
    return en
      ? `less than ${formatMeritBound(hi, locale)} ${unit}`
      : `menej ako ${formatMeritBound(hi, locale)} ${unit}`;
  }
  if (isLast) return `${formatMeritBound(lo, locale)}+ ${unit}`;
  return `${formatMeritBound(lo, locale)} – ${formatMeritBound(hi, locale)} ${unit}`;
}

/**
 * Bucket index around the people-weighted median (50th percentile of counts).
 * Used to demo bar selection on the anonymous Home histogram.
 */
export function medianBucketIndex(distribution: RankDistribution): number {
  const n = distribution.buckets.length;
  if (n <= 0) return 0;
  const total = histogramPopulation(distribution);
  if (total <= 0) return Math.floor(n / 2);
  let cumulative = 0;
  const target = total / 2;
  for (let i = 0; i < n; i++) {
    cumulative += distribution.buckets[i]!.count;
    if (cumulative >= target) return i;
  }
  return n - 1;
}

/**
 * Population for the rank ladder / percentile.
 * Prefer the sum of histogram buckets (same as the mockup) — Rovas
 * `total_users` also counts zero-ME accounts that are excluded from bins,
 * which would squash every runner toward the left of the track.
 *
 * Same figure is the Merit-holder count (users with ME > 0 in the histogram).
 */
export function histogramPopulation(distribution: RankDistribution): number {
  const fromBuckets = distribution.buckets.reduce((sum, b) => sum + b.count, 0);
  if (fromBuckets > 0) return fromBuckets;
  return distribution.total_users ?? 0;
}

function percentileFromLogEdges(
  me: number,
  buckets: RankBucket[],
  edges: number[],
  total: number,
): number {
  if (me <= 0) return 0;
  const logMe = Math.log10(Math.max(me, Number.MIN_VALUE));
  let cumulative = 0;

  for (let i = 0; i < buckets.length; i++) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const count = buckets[i]!.count;
    if (logMe < lo) {
      return (cumulative / total) * 100;
    }
    if (logMe <= hi || i === buckets.length - 1) {
      const frac =
        hi === lo ? 0.5 : Math.min(1, Math.max(0, (logMe - lo) / (hi - lo)));
      return ((cumulative + frac * count) / total) * 100;
    }
    cumulative += count;
  }
  return 100;
}

function formatMeritBound(n: number, locale: string): string {
  if (n === 0) return "0";
  if (n < 1) {
    return n.toLocaleString(locale, { maximumFractionDigits: 2 });
  }
  if (n >= 1000) {
    return Math.round(n).toLocaleString(locale);
  }
  return n !== Math.round(n)
    ? n.toLocaleString(locale, { maximumFractionDigits: 1 })
    : Math.round(n).toLocaleString(locale);
}
