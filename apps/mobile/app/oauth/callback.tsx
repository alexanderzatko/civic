import { useEffect } from "react";
import { router } from "expo-router";
import { AppSplash } from "@/components/AppSplash";
import { loadPendingOAuth } from "@/lib/auth-storage";
import { useAuth } from "@/lib/auth";

const FALLBACK_REDIRECT_MS = 12_000;

/**
 * Shown while Rovas OAuth finishes after `civic://oauth/callback`.
 * Deep links are rewritten here by `+native-intent` (query string stripped).
 */
export default function OAuthCallbackScreen() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "signedIn") {
      router.replace("/");
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (status === "loading" || status === "signedIn") return;
      const pending = await loadPendingOAuth();
      if (cancelled || pending) return;
      router.replace("/");
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/");
    }, FALLBACK_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, []);

  return <AppSplash />;
}
