import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  MERITS_POLL_INTERVAL_MS,
  subscribeMeritsChanged,
} from "@/lib/merits-refresh";

/**
 * Invoke `refresh` when the screen is focused, the app returns to the
 * foreground, merits may have changed locally, or on a quiet interval while
 * focused — so ME totals do not go stale if the app is left open.
 */
export function useMeritsAutoRefresh(refresh: () => void): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const focusedRef = useRef(false);

  const run = useCallback(() => {
    refreshRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      run();
      const interval = setInterval(run, MERITS_POLL_INTERVAL_MS);
      return () => {
        focusedRef.current = false;
        clearInterval(interval);
      };
    }, [run]),
  );

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === "active" && focusedRef.current) {
        run();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [run]);

  useEffect(() => subscribeMeritsChanged(run), [run]);
}
