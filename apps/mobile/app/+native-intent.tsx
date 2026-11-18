/**
 * Intercept native deep links before Expo Router matches routes.
 *
 * Rovas returns `civic://oauth/callback?code=…&state=…`. Expo Router's path
 * extractor keeps the query string (`oauth/callback?code=…`), which fails to
 * match `app/oauth/callback.tsx` and briefly lands on +not-found.
 *
 * IdP redirects (`oauth/openstreetmap`, `nabezky`, `facebook`) must NOT go
 * through the Rovas callback screen — that screen bounces signed-out users to
 * Home and drops the in-progress AuthForm (OSM email step). They land on a
 * short splash that restores the auth screen while Linking completes OAuth.
 *
 * Rewrite to the clean splash route. AuthProvider / IdP helpers still receive
 * the original URL via `Linking` and complete the token exchange.
 */
export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (isIdpOAuthReturnPath(path)) {
      return "/oauth/idp-return";
    }
    if (isRovasOAuthCallbackPath(path)) {
      return "/oauth/callback";
    }
    return path;
  } catch {
    return "/";
  }
}

function isIdpOAuthReturnPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return (
    normalized.includes("oauth/nabezky") ||
    normalized.includes("oauth/openstreetmap") ||
    normalized.includes("oauth/facebook")
  );
}

function isRovasOAuthCallbackPath(path: string): boolean {
  const normalized = path.toLowerCase();
  if (isIdpOAuthReturnPath(normalized)) return false;
  return (
    normalized.includes("oauth/callback") ||
    // Rare parsers: host `oauth`, path `/callback`
    (normalized.includes("://oauth") && normalized.includes("callback"))
  );
}
