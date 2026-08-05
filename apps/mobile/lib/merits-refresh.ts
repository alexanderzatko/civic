/**
 * Lightweight pub/sub so screens that show ME can refresh after local
 * mutations (e.g. successful receipt claim) without a global store.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Notify ME-displaying screens that balances may have changed. */
export function notifyMeritsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMeritsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Quiet re-fetch while a ME screen stays focused / app stays open. */
export const MERITS_POLL_INTERVAL_MS = 5 * 60 * 1000;
