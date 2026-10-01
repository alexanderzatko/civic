import { useEffect } from "react";
import { usePathname } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { screen, setAnalyticsClient } from "@/lib/analytics";

/** Keeps the module-level client in sync and records expo-router screen views. */
export function AnalyticsBridge() {
  const posthog = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    setAnalyticsClient(posthog ?? null);
    return () => setAnalyticsClient(null);
  }, [posthog]);

  useEffect(() => {
    if (!pathname) return;
    // Pathname already includes dynamic segments (e.g. /community/alice).
    // Do not attach search params — avoids OAuth codes and PII leakage.
    screen(pathname);
  }, [pathname]);

  return null;
}
