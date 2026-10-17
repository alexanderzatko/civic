import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  PENDING_COMMENT_NOTICES_POLL_MS,
  clearPendingCommentNoticesState,
  refreshPendingCommentNotices,
} from "@/lib/pending-comment-notices";

/**
 * Keep pending watched-comment notices fresh while signed in.
 * Mounted once under tabs — do not use useFocusEffect here (layouts are not
 * focused screens, so tab switches would never trigger a refresh).
 */
export function usePendingCommentNoticesRefresh(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const run = useCallback(async () => {
    if (!enabledRef.current) {
      clearPendingCommentNoticesState();
      return;
    }
    await refreshPendingCommentNotices();
  }, []);

  useEffect(() => {
    void run();
  }, [enabled, run]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(
      () => void run(),
      PENDING_COMMENT_NOTICES_POLL_MS,
    );
    return () => clearInterval(interval);
  }, [enabled, run]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void run();
    });
    return () => sub.remove();
  }, [run]);
}
