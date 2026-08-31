import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchPendingVerifications } from "@/lib/api";
import {
  PENDING_VERIFICATIONS_POLL_MS,
  setPendingVerifications,
} from "@/lib/pending-verifications";

/**
 * Poll pending verification slots while focused / app active.
 */
export function usePendingVerificationsRefresh(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const focusedRef = useRef(false);

  const run = useCallback(async () => {
    if (!enabledRef.current) {
      setPendingVerifications({ total: 0, items: [] });
      return;
    }
    try {
      const page = await fetchPendingVerifications();
      setPendingVerifications(page);
    } catch {
      // Keep last good values when offline or Rovas endpoints not live yet.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      void run();
      const interval = setInterval(() => void run(), PENDING_VERIFICATIONS_POLL_MS);
      return () => {
        focusedRef.current = false;
        clearInterval(interval);
      };
    }, [run]),
  );

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === "active" && focusedRef.current) {
        void run();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [run]);
}
