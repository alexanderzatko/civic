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

/** Whole-percent equal split of `total`; remainder goes to index 0. */
export function equalWholeParts(total: number, count: number): number[] {
  if (count <= 0) return [];
  const t = Math.max(0, Math.round(total));
  if (count === 1) return [t];
  const base = Math.floor(t / count);
  const rem = t - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? rem : 0));
}

/** Whole-percent equal split; remainder goes to index 0 (scanner). */
export function equalWholePercents(count: number): number[] {
  return equalWholeParts(100, count);
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

/**
 * Apply a manual % edit: lock that recipient, then redistribute the remaining
 * whole percents equally among recipients that have never been manually
 * adjusted. Locked shares keep their current values (except the edited one).
 * If every other recipient is already locked, only the edited field changes.
 */
export function applyManualShare(
  recipients: SplitRecipient[],
  editedUid: string,
  newSharePct: number,
  manuallyAdjustedUids: ReadonlySet<string>,
): { recipients: SplitRecipient[]; manuallyAdjustedUids: Set<string> } {
  const locked = new Set(manuallyAdjustedUids);
  locked.add(editedUid);

  const editedPct = Number.isFinite(newSharePct) ? Math.max(0, newSharePct) : 0;

  let lockedSum = 0;
  const unlockedIndices: number[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]!;
    if (r.rovas_uid === editedUid) {
      lockedSum += editedPct;
    } else if (locked.has(r.rovas_uid)) {
      lockedSum += r.sharePct;
    } else {
      unlockedIndices.push(i);
    }
  }

  if (unlockedIndices.length === 0) {
    return {
      recipients: recipients.map((r) =>
        r.rovas_uid === editedUid ? { ...r, sharePct: editedPct } : r,
      ),
      manuallyAdjustedUids: locked,
    };
  }

  const remaining = Math.max(0, Math.round(100 - lockedSum));
  const parts = equalWholeParts(remaining, unlockedIndices.length);
  const byIndex = new Map(
    unlockedIndices.map((idx, j) => [idx, parts[j] ?? 0]),
  );

  return {
    recipients: recipients.map((r, i) => {
      if (r.rovas_uid === editedUid) return { ...r, sharePct: editedPct };
      const auto = byIndex.get(i);
      return auto === undefined ? r : { ...r, sharePct: auto };
    }),
    manuallyAdjustedUids: locked,
  };
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
