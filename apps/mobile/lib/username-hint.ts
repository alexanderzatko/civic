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
