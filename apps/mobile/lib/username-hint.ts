import * as SecureStore from "expo-secure-store";

const PENDING_KEY = "civic.profile.username_hint_pending";

/** Mark that the next Profile visit should show the auto-username tip (register). */
export async function markUsernameHintPending(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_KEY, "1");
  } catch {
    // SecureStore unavailable — tip may not show.
  }
}

export async function hasUsernameHintPending(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PENDING_KEY)) === "1";
  } catch {
    return false;
  }
}

const FRESH_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/** True when Rovas `created` is within the last 24 hours. */
export function isFreshAccount(created: string | null | undefined): boolean {
  if (!created) return false;
  const ms = Date.parse(created);
  if (!Number.isFinite(ms)) return false;
  const age = Date.now() - ms;
  return age >= 0 && age < FRESH_ACCOUNT_MS;
}

function dismissedKey(rovasUid: string): string {
  return `civic.profile.username_hint_dismissed.${rovasUid}`;
}

export async function isUsernameHintDismissed(
  rovasUid: string,
): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(dismissedKey(rovasUid))) === "1";
  } catch {
    return false;
  }
}

export async function dismissUsernameHint(rovasUid: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(dismissedKey(rovasUid), "1");
    await SecureStore.deleteItemAsync(PENDING_KEY);
  } catch {
    // ignore
  }
}
