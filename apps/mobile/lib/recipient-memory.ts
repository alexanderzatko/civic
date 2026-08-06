import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "civic.receipts.recipientMemory";
const MAX_ENTRIES = 20;

export type MemoryRecipient = {
  rovas_uid: string;
  username: string;
  display_name: string;
  alwaysShare: boolean;
  lastUsedAt: number;
};

export async function loadRecipientMemory(): Promise<MemoryRecipient[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is MemoryRecipient =>
          r != null &&
          typeof r === "object" &&
          typeof (r as MemoryRecipient).rovas_uid === "string" &&
          typeof (r as MemoryRecipient).username === "string",
      )
      .map((r) => ({
        rovas_uid: r.rovas_uid,
        username: r.username,
        display_name:
          typeof r.display_name === "string" && r.display_name
            ? r.display_name
            : r.username,
        alwaysShare: Boolean(r.alwaysShare),
        lastUsedAt: typeof r.lastUsedAt === "number" ? r.lastUsedAt : 0,
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

async function saveRecipientMemory(entries: MemoryRecipient[]): Promise<void> {
  const sorted = [...entries]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
}

/** Upsert one memory row (LRU by lastUsedAt). */
export async function rememberRecipient(
  entry: Omit<MemoryRecipient, "lastUsedAt"> & { lastUsedAt?: number },
): Promise<MemoryRecipient[]> {
  const current = await loadRecipientMemory();
  const next: MemoryRecipient = {
    rovas_uid: entry.rovas_uid,
    username: entry.username,
    display_name: entry.display_name,
    alwaysShare: entry.alwaysShare,
    lastUsedAt: entry.lastUsedAt ?? Date.now(),
  };
  const without = current.filter((r) => r.rovas_uid !== next.rovas_uid);
  without.unshift(next);
  await saveRecipientMemory(without);
  return without;
}

export async function setAlwaysShare(
  rovasUid: string,
  alwaysShare: boolean,
): Promise<MemoryRecipient[]> {
  const current = await loadRecipientMemory();
  const next = current.map((r) =>
    r.rovas_uid === rovasUid ? { ...r, alwaysShare } : r,
  );
  await saveRecipientMemory(next);
  return next;
}

export async function touchRecipients(
  uids: Array<{
    rovas_uid: string;
    username: string;
    display_name: string;
    alwaysShare: boolean;
  }>,
): Promise<void> {
  const now = Date.now();
  let current = await loadRecipientMemory();
  for (const u of uids) {
    const existing = current.find((r) => r.rovas_uid === u.rovas_uid);
    const row: MemoryRecipient = {
      rovas_uid: u.rovas_uid,
      username: u.username,
      display_name: u.display_name,
      alwaysShare: existing?.alwaysShare ?? u.alwaysShare,
      lastUsedAt: now,
    };
    current = [
      row,
      ...current.filter((r) => r.rovas_uid !== u.rovas_uid),
    ];
  }
  await saveRecipientMemory(current);
}
