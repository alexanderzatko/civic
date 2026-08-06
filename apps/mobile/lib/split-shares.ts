import { displayMerits } from "@civic/shared";

export type SplitRecipient = {
  rovas_uid: string;
  username: string;
  display_name: string;
  sharePct: number;
  isScanner: boolean;
  alwaysShare: boolean;
};

/** Whole-percent equal split; remainder goes to index 0 (scanner). */
export function equalWholePercents(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [100];
  const base = Math.floor(100 / count);
  const rem = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? rem : 0));
}

export function withEqualShares(
  recipients: Omit<SplitRecipient, "sharePct">[],
): SplitRecipient[] {
  const pcts = equalWholePercents(recipients.length);
  return recipients.map((r, i) => ({ ...r, sharePct: pcts[i] ?? 0 }));
}

export function shareSum(recipients: SplitRecipient[]): number {
  return Math.round(recipients.reduce((s, r) => s + r.sharePct, 0) * 100) / 100;
}

export function previewMeritsForShare(
  totalMerits: number,
  sharePct: number,
): number {
  return Math.floor(((totalMerits * sharePct) / 100) * 100) / 100;
}

export function formatShareMerits(totalMerits: number, sharePct: number): string {
  return String(displayMerits(previewMeritsForShare(totalMerits, sharePct)));
}
