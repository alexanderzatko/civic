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
