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

export const PENDING_VERIFICATIONS_POLL_MS = 5 * 60 * 1000;
