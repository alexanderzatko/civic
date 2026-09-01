import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { TokenResponseConfig } from "expo-auth-session";

const STORAGE_KEY = "civic.rovas.oauth.tokens";
const PENDING_OAUTH_KEY = "civic.rovas.oauth.pending";

async function setRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getRaw(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteRaw(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/** PKCE session saved before opening the browser (Android cold-start resume). */
export type PendingOAuth = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  startedAt: number;
};

const PENDING_OAUTH_TTL_MS = 5 * 60 * 1000;

export type StoredTokens = TokenResponseConfig;

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await setRaw(STORAGE_KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = await getRaw(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    await deleteRaw(STORAGE_KEY);
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await deleteRaw(STORAGE_KEY);
}

export async function savePendingOAuth(pending: PendingOAuth): Promise<void> {
  await setRaw(PENDING_OAUTH_KEY, JSON.stringify(pending));
}

export async function loadPendingOAuth(): Promise<PendingOAuth | null> {
  const raw = await getRaw(PENDING_OAUTH_KEY);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingOAuth;
    if (Date.now() - pending.startedAt > PENDING_OAUTH_TTL_MS) {
      await deleteRaw(PENDING_OAUTH_KEY);
      return null;
    }
    return pending;
  } catch {
    await deleteRaw(PENDING_OAUTH_KEY);
    return null;
  }
}

export async function clearPendingOAuth(): Promise<void> {
  await deleteRaw(PENDING_OAUTH_KEY);
}
