import Constants from "expo-constants";
import { makeRedirectUri, type DiscoveryDocument } from "expo-auth-session";

const extra = Constants.expoConfig?.extra as
  | { rovasBaseUrl?: string; rovasOAuthClientId?: string }
  | undefined;

/** Rovas origin used for OAuth (dev by default). */
export function getRovasBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_ROVAS_BASE_URL ??
    extra?.rovasBaseUrl ??
    "https://dev.rovas.app"
  );
}

export function getOAuthClientId(): string {
  return (
    process.env.EXPO_PUBLIC_ROVAS_OAUTH_CLIENT_ID ??
    extra?.rovasOAuthClientId ??
    "civic"
  );
}

export const OAUTH_SCOPES = ["user_profile"] as const;

/**
 * Must match the redirect URI registered on the Rovas `civic` OAuth client.
 * Requires a development build or standalone app — Expo Go cannot claim `civic://`.
 */
export function getOAuthRedirectUri(): string {
  return makeRedirectUri({
    scheme: "civic",
    path: "oauth/callback",
    native: "civic://oauth/callback",
  });
}

export function getRovasDiscovery(): DiscoveryDocument {
  const base = getRovasBaseUrl().replace(/\/$/, "");
  return {
    authorizationEndpoint: `${base}/oauth2/authorize`,
    tokenEndpoint: `${base}/oauth2/token`,
    revocationEndpoint: `${base}/oauth2/revoke`,
  };
}
