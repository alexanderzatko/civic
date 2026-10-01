import { useEffect, useRef } from "react";
import { fetchMe } from "@/lib/api";
import { identify } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";

/** Identify the PostHog person once per signed-in session via `/me`. */
export function AnalyticsIdentify() {
  const { status } = useAuth();
  const identifiedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") {
      identifiedUidRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMe();
        if (cancelled || !me.rovas_uid) return;
        if (identifiedUidRef.current === me.rovas_uid) return;
        identifiedUidRef.current = me.rovas_uid;
        identify(me.rovas_uid, {
          ...(me.username ? { username: me.username } : {}),
        });
      } catch {
        // Identify is best-effort; avoid blocking the app on `/me` failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
