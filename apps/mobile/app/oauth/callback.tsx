import { useEffect } from "react";
import { router } from "expo-router";
import { AppSplash } from "@/components/AppSplash";
import { loadPendingOAuth } from "@/lib/auth-storage";
import { useAuth } from "@/lib/auth";

const FALLBACK_REDIRECT_MS = 12_000;

/**
 * Deep-link target for `civic://oauth/callback` after Rovas login.
 * AuthProvider / signIn complete the token exchange; this screen only
 * bridges with the native splash look until Home is ready.
 */
export default function OAuthCallbackScreen() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "signedIn") {
      router.replace("/(tabs)");
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (status === "loading" || status === "signedIn") return;
      // Still exchanging (Android browser return) — keep splash.
      const pending = await loadPendingOAuth();
      if (cancelled || pending) return;
      router.replace("/(tabs)");
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, FALLBACK_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, []);

  return <AppSplash />;
}
