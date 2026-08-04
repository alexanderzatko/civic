import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { TokenResponseConfig } from "expo-auth-session";

const STORAGE_KEY = "civic.rovas.oauth.tokens";

async function setRaw(value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

async function getRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  }
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function deleteRaw(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export type StoredTokens = TokenResponseConfig;

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await setRaw(JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = await getRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    await deleteRaw();
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await deleteRaw();
}
