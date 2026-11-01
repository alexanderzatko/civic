import { dismissTrustedNotify, fetchMe } from "@/lib/api";

export type TrustedNotifyState = {
  rovas_uid: string | null;
  trusted_user: boolean;
  trusted_notify: 0 | 1 | 2;
};

const empty: TrustedNotifyState = {
  rovas_uid: null,
  trusted_user: false,
  trusted_notify: 0,
};

let cached = empty;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getTrustedNotifyState(): TrustedNotifyState {
  return cached;
}

export function setTrustedNotifyState(next: TrustedNotifyState): void {
  cached = next;
  emit();
}

export function subscribeTrustedNotify(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearTrustedNotifyState(): void {
  setTrustedNotifyState(empty);
}

/** True when the congratulations banner should show. */
export function shouldShowTrustedNotify(state: TrustedNotifyState): boolean {
  return state.trusted_user && state.trusted_notify === 1;
}

/** Fetch Trusted notify fields from `GET /me` and update the local store. */
export async function refreshTrustedNotify(): Promise<void> {
  try {
    const me = await fetchMe();
    setTrustedNotifyState({
      rovas_uid: me.rovas_uid ?? null,
      trusted_user: me.trusted_user === true,
      trusted_notify:
        me.trusted_notify === 1 || me.trusted_notify === 2
          ? me.trusted_notify
          : 0,
    });
  } catch {
    // Keep last good values when offline or endpoints are unavailable.
  }
}

/**
 * Optimistically hide the banner, then permanently dismiss on Rovas.
 * On failure, re-fetch so the banner can reappear.
 */
export async function dismissTrustedNotifyBanner(): Promise<void> {
  const prev = cached;
  setTrustedNotifyState({
    ...prev,
    trusted_notify: 2,
  });
  try {
    const result = await dismissTrustedNotify();
    setTrustedNotifyState({
      rovas_uid: prev.rovas_uid,
      trusted_user: result.trusted_user,
      trusted_notify: result.trusted_notify,
    });
  } catch {
    await refreshTrustedNotify();
  }
}

/** Poll while the app is open (same cadence as verification notices). */
export const TRUSTED_NOTIFY_POLL_MS = 60 * 1000;
