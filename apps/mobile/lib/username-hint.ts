import * as SecureStore from "expo-secure-store";

const PENDING_KEY = "civic.profile.username_hint_pending";

/**
 * In-memory only for *showing* the tip. SecureStore alone used to leave a
 * stale flag on device (e.g. after an earlier Apple/Google register), so
 * password signups on the same phone still saw “We created your username…”.
 */
let sessionPending = false;

/** Mark that the next Profile visit should show the auto-username tip (social register). */
export async function markUsernameHintPending(): Promise<void> {
  sessionPending = true;
  try {
    await SecureStore.setItemAsync(PENDING_KEY, "1");
  } catch {
    // SecureStore unavailable — session flag still works for this run.
  }
}

/** Password register/login — never show the social auto-username tip. */
export async function clearUsernameHintPending(): Promise<void> {
  sessionPending = false;
  try {
    await SecureStore.deleteItemAsync(PENDING_KEY);
  } catch {
    // ignore
  }
}

export async function hasUsernameHintPending(): Promise<boolean> {
  return sessionPending;
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
  sessionPending = false;
  try {
    await SecureStore.setItemAsync(dismissedKey(rovasUid), "1");
    await SecureStore.deleteItemAsync(PENDING_KEY);
  } catch {
    // ignore
  }
}
