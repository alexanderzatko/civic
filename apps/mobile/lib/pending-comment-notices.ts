import { fetchPendingCommentNotices } from "@/lib/api";
import type { PendingCommentNoticesPage } from "@civic/shared";

const empty: PendingCommentNoticesPage = { total: 0, items: [] };

let cached = empty;
const listeners = new Set<() => void>();

export function getPendingCommentNotices(): PendingCommentNoticesPage {
  return cached;
}

export function setPendingCommentNotices(page: PendingCommentNoticesPage): void {
  cached = page;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePendingCommentNotices(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearPendingCommentNoticesState(): void {
  setPendingCommentNotices(empty);
}

/** Fetch pending watched-comment notices from the API and update the local store. */
export async function refreshPendingCommentNotices(): Promise<void> {
  try {
    const page = await fetchPendingCommentNotices();
    setPendingCommentNotices({
      total: typeof page.total === "number" ? page.total : page.items.length,
      items: Array.isArray(page.items) ? page.items : [],
    });
  } catch {
    // Keep last good values when offline or endpoints are unavailable.
  }
}

/** Poll while the app is open (navigation + foreground also trigger refresh). */
export const PENDING_COMMENT_NOTICES_POLL_MS = 60 * 1000;
