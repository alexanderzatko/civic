import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "civic.community.recentProfiles";
const MAX_ENTRIES = 5;

export type RecentProfile = {
  username: string;
  display_name: string;
  total_me: number;
  viewed_at: number;
};

export async function loadRecentProfiles(): Promise<RecentProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentProfile =>
          r != null &&
          typeof r === "object" &&
          typeof (r as RecentProfile).username === "string" &&
          typeof (r as RecentProfile).total_me === "number",
      )
      .map((r) => ({
        username: r.username,
        display_name:
          typeof r.display_name === "string" && r.display_name
            ? r.display_name
            : r.username,
        total_me: r.total_me,
        viewed_at: typeof r.viewed_at === "number" ? r.viewed_at : 0,
      }))
      .sort((a, b) => b.viewed_at - a.viewed_at)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

async function saveRecentProfiles(entries: RecentProfile[]): Promise<void> {
  const sorted = [...entries]
    .sort((a, b) => b.viewed_at - a.viewed_at)
    .slice(0, MAX_ENTRIES);
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // SecureStore size limits / unavailable — keep in-session only.
  }
}

/** Upsert a recently viewed public profile (LRU by viewed_at). */
export async function rememberRecentProfile(
  entry: Omit<RecentProfile, "viewed_at"> & { viewed_at?: number },
): Promise<RecentProfile[]> {
  const current = await loadRecentProfiles();
  const next: RecentProfile = {
    username: entry.username,
    display_name: entry.display_name,
    total_me: entry.total_me,
    viewed_at: entry.viewed_at ?? Date.now(),
  };
  const without = current.filter(
    (r) => r.username.toLowerCase() !== next.username.toLowerCase(),
  );
  without.unshift(next);
  await saveRecentProfiles(without);
  return without;
}
