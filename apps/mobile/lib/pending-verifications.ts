import { fetchPendingVerifications } from "@/lib/api";
import type { PendingVerificationsPage } from "@civic/shared";

const empty: PendingVerificationsPage = { total: 0, items: [] };

let cached = empty;
const listeners = new Set<() => void>();
/** Slots acted on locally; filtered from API refresh until server stops returning them. */
const completedSlotNids = new Set<string>();

function applyPendingPage(page: PendingVerificationsPage): PendingVerificationsPage {
  const apiIds = new Set(page.items.map((item) => item.slot_nid));
  for (const slotNid of completedSlotNids) {
    if (!apiIds.has(slotNid)) {
      completedSlotNids.delete(slotNid);
    }
  }
  const items = page.items.filter((item) => !completedSlotNids.has(item.slot_nid));
  return { total: items.length, items };
}

export function getPendingVerifications(): PendingVerificationsPage {
  return cached;
}

export function setPendingVerifications(page: PendingVerificationsPage): void {
  cached = page;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePendingVerifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPendingVerificationsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function removePendingVerification(slotNid: string): void {
  const nextItems = cached.items.filter((item) => item.slot_nid !== slotNid);
  if (nextItems.length === cached.items.length) {
    return;
  }
  setPendingVerifications({
    total: nextItems.length,
    items: nextItems,
  });
}

/** Record a completed verification and drop it from the in-app pending list. */
export function markVerificationCompleted(slotNid: string): void {
  if (!slotNid) return;
  completedSlotNids.add(slotNid);
  removePendingVerification(slotNid);
}

export function isVerificationSlotCompleted(slotNid: string): boolean {
  return completedSlotNids.has(slotNid);
}

export function clearPendingVerificationsState(): void {
  completedSlotNids.clear();
  setPendingVerifications(empty);
}

/** Fetch pending slots from the API and update the local store. */
export async function refreshPendingVerifications(): Promise<void> {
  try {
    const page = await fetchPendingVerifications();
    setPendingVerifications(applyPendingPage(page));
  } catch {
    // Keep last good values when offline or endpoints are unavailable.
  }
}

/** Poll while the app is open (navigation + foreground also trigger refresh). */
export const PENDING_VERIFICATIONS_POLL_MS = 60 * 1000;
