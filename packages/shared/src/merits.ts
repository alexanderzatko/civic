/**
 * Merit conversion — aligns with Rovas (`hours = merits / 10`).
 *
 *   merits = round((vat_eur / hourly_wage_eur) * merits_per_hour, 2)
 */

export interface MeritInput {
  vatEur: number;
  hourlyWageEur: number;
  meritsPerHour?: number;
}

export function computeMerits(input: MeritInput): number {
  const { vatEur, hourlyWageEur, meritsPerHour = 10 } = input;
  if (hourlyWageEur <= 0) {
    throw new Error("hourlyWageEur must be positive");
  }
  if (vatEur < 0) {
    throw new Error("vatEur must be non-negative");
  }
  return round2((vatEur / hourlyWageEur) * meritsPerHour);
}

/** Round to 2 decimal places (storage / API). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Floor to 2 decimal places (per-share Merit allocation). */
export function floor2(n: number): number {
  return Math.floor(n * 100) / 100;
}

/**
 * Split total Merits across share percentages.
 * Residue from flooring is assigned to the scanner so the sum equals total.
 */
export function splitMerits(params: {
  totalMerits: number;
  shares: Array<{ rovasUid: string; sharePct: number }>;
  scannerRovasUid: string;
}): Array<{
  rovasUid: string;
  sharePct: number;
  meritsAwarded: number;
  roundingResidue: number;
}> {
  const { totalMerits, shares, scannerRovasUid } = params;
  const rows = shares.map((s) => ({
    rovasUid: s.rovasUid,
    sharePct: s.sharePct,
    meritsAwarded: floor2((totalMerits * s.sharePct) / 100),
    roundingResidue: 0,
  }));

  const awarded = rows.reduce((sum, r) => sum + r.meritsAwarded, 0);
  const residue = round2(totalMerits - awarded);
  if (residue !== 0) {
    const scanner = rows.find((r) => r.rovasUid === scannerRovasUid);
    if (!scanner) {
      throw new Error("scanner must be included in shares");
    }
    scanner.meritsAwarded = round2(scanner.meritsAwarded + residue);
    scanner.roundingResidue = residue;
  }
  return rows;
}

/** UI display: whole-number Merits (and EUR equivalents). */
export function displayMerits(merits: number): number {
  return Math.round(merits);
}

/** SI prefixes for sub-ME amounts (steps of 10³). */
export type MeritSiPrefix = "" | "m" | "μ" | "n" | "p";

export type CompactMerits = {
  /** Signed, locale-formatted coefficient (no unit). */
  coefficient: string;
  /** Empty for ≥ 1 ME; otherwise milli / micro / nano / pico. */
  prefix: MeritSiPrefix;
};

const PREFIX_BY_EXP: Record<number, MeritSiPrefix> = {
  [-3]: "m",
  [-6]: "μ",
  [-9]: "n",
  [-12]: "p",
};

/**
 * Compact ME for history rows: ≥ 1 ME keeps up to 2 decimals; smaller
 * amounts use m / μ / n / p so the coefficient stays in [1, 1000)
 * (e.g. 0.42 → "420 m", 0.0015 → "1.5 m").
 */
export function formatMeritsCompact(
  merits: number,
  locale = "sk-SK",
): CompactMerits {
  if (!Number.isFinite(merits) || merits === 0) {
    return { coefficient: "0", prefix: "" };
  }

  const sign = merits < 0 ? -1 : 1;
  const abs = Math.abs(merits);

  if (abs >= 1) {
    return {
      coefficient: (sign * round2(abs)).toLocaleString(locale, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }),
      prefix: "",
    };
  }

  // Thousands-step exponent in {-3,-6,-9,-12}.
  const exp = Math.max(-12, Math.floor(Math.log10(abs) / 3) * 3) as
    | -3
    | -6
    | -9
    | -12;
  const prefix = PREFIX_BY_EXP[exp] ?? "p";
  const scaled = round2(abs * 10 ** -exp);
  return {
    coefficient: (sign * scaled).toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }),
    prefix,
  };
}

/** Coefficient plus optional SI prefix, e.g. "1.67" or "420 m". */
export function formatMeritsCompactLabel(
  merits: number,
  locale = "sk-SK",
): string {
  const { coefficient, prefix } = formatMeritsCompact(merits, locale);
  return prefix ? `${coefficient} ${prefix}` : coefficient;
}
