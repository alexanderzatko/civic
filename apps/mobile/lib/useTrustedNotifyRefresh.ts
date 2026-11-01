import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  TRUSTED_NOTIFY_POLL_MS,
  clearTrustedNotifyState,
  refreshTrustedNotify,
} from "@/lib/trusted-notify";

/**
 * Keep Trusted congratulations notify fresh while signed in.
 * Mounted once under tabs — do not use useFocusEffect here (layouts are not
 * focused screens, so tab switches would never trigger a refresh).
 */
export function useTrustedNotifyRefresh(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const run = useCallback(async () => {
    if (!enabledRef.current) {
      clearTrustedNotifyState();
      return;
    }
    await refreshTrustedNotify();
  }, []);

  useEffect(() => {
    void run();
  }, [enabled, run]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => void run(), TRUSTED_NOTIFY_POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, run]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void run();
    });
    return () => sub.remove();
  }, [run]);
}
