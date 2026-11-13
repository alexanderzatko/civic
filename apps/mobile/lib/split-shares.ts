import {
  ANONYMOUS_SHARE_UID,
  displayMerits,
  isAnonymousShareUid,
} from "@civic/shared";

export type SplitRecipient = {
  rovas_uid: string;
  username: string;
  display_name: string;
  sharePct: number;
  isScanner: boolean;
  alwaysShare: boolean;
  isAnonymous?: boolean;
};

export { ANONYMOUS_SHARE_UID, isAnonymousShareUid };

export function anonymousRecipient(): Omit<SplitRecipient, "sharePct"> {
  return {
    rovas_uid: ANONYMOUS_SHARE_UID,
    username: ANONYMOUS_SHARE_UID,
    display_name: ANONYMOUS_SHARE_UID,
    isScanner: false,
    alwaysShare: false,
    isAnonymous: true,
  };
}

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

export function scannerSharePositive(recipients: SplitRecipient[]): boolean {
  const scanner = recipients.find((r) => r.isScanner);
  return (scanner?.sharePct ?? 0) > 0;
}

export function previewMeritsForShare(
  totalMerits: number,
  sharePct: number,
  options?: { burned?: boolean },
): number {
  if (options?.burned) return 0;
  return Math.floor(((totalMerits * sharePct) / 100) * 100) / 100;
}

export function formatShareMerits(
  totalMerits: number,
  sharePct: number,
  options?: { burned?: boolean },
): string {
  return String(
    displayMerits(previewMeritsForShare(totalMerits, sharePct, options)),
  );
}

/** Label for a history / share uid (Anonymous sentinel → localized). */
export function shareBeneficiaryLabel(
  uid: string,
  fallback: string,
  anonymousLabel: string,
): string {
  return isAnonymousShareUid(uid) ? anonymousLabel : fallback;
}
