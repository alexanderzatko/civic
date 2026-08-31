import { fetchPendingVerifications } from "@/lib/api";
import type { PendingVerificationsPage } from "@civic/shared";

const empty: PendingVerificationsPage = { total: 0, items: [] };

let cached = empty;
const listeners = new Set<() => void>();

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

/** Fetch pending slots from the API and update the local store. */
export async function refreshPendingVerifications(): Promise<void> {
  try {
    const page = await fetchPendingVerifications();
    setPendingVerifications(page);
  } catch {
    // Keep last good values when offline or endpoints are unavailable.
  }
}

/** Poll while the app is open (navigation + foreground also trigger refresh). */
export const PENDING_VERIFICATIONS_POLL_MS = 60 * 1000;
