import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "civic.merit_spotlight.dismissed_day";

/** Local calendar day key `YYYY-MM-DD` for dismiss persistence. */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function isSpotlightDismissedToday(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw === localDayKey();
  } catch {
    return false;
  }
}

export async function dismissSpotlightForToday(): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, localDayKey());
  } catch {
    // SecureStore unavailable — dismiss lasts for this session only via caller state.
  }
}
