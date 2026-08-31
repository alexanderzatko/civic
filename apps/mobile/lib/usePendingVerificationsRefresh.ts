import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  PENDING_VERIFICATIONS_POLL_MS,
  clearPendingVerificationsState,
  refreshPendingVerifications,
} from "@/lib/pending-verifications";

/**
 * Keep pending verification slots fresh while signed in.
 * Mounted once under tabs — do not use useFocusEffect here (layouts are not
 * focused screens, so tab switches would never trigger a refresh).
 */
export function usePendingVerificationsRefresh(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const run = useCallback(async () => {
    if (!enabledRef.current) {
      clearPendingVerificationsState();
      return;
    }
    await refreshPendingVerifications();
  }, []);

  useEffect(() => {
    void run();
  }, [enabled, run]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => void run(), PENDING_VERIFICATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, run]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void run();
    });
    return () => sub.remove();
  }, [run]);
}
