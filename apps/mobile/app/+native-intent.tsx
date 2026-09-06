/**
 * Intercept native deep links before Expo Router matches routes.
 *
 * Rovas returns `civic://oauth/callback?code=…&state=…`. Expo Router's path
 * extractor keeps the query string (`oauth/callback?code=…`), which fails to
 * match `app/oauth/callback.tsx` and briefly lands on +not-found.
 *
 * Rewrite to the clean splash route. AuthProvider / signIn still receive the
 * original URL via `Linking` and complete the token exchange.
 */
export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (isOAuthCallbackPath(path)) {
      return "/oauth/callback";
    }
    return path;
  } catch {
    return "/";
  }
}

function isOAuthCallbackPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return (
    normalized.includes("oauth/callback") ||
    // Rare parsers: host `oauth`, path `/callback`
    (normalized.includes("://oauth") && normalized.includes("callback"))
  );
}
