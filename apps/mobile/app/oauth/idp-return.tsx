import { useEffect } from "react";
import { router } from "expo-router";
import { AppSplash } from "@/components/AppSplash";
import { consumeIdpAuthReturnPath } from "@/lib/oauth-browser";

/**
 * Shown briefly while Facebook / Nabezky / OSM browser OAuth returns via
 * `civic://oauth/{provider}`. Linking listeners in the IdP helpers complete
 * the exchange; this screen only restores the auth UI (so OSM can show the
 * email step) instead of bouncing to Home like the Rovas callback does.
 */
export default function IdpOAuthReturnScreen() {
  useEffect(() => {
    const returnPath = consumeIdpAuthReturnPath();
    const timer = setTimeout(() => {
      router.replace(returnPath);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return <AppSplash />;
}
