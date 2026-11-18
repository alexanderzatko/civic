import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/lib/api";
import { getLocale } from "@/lib/i18n";
import type { StoredTokens } from "@/lib/auth-storage";
import {
  authorizeWithBrowserCode,
  authorizeWithBrowserToken,
} from "@/lib/oauth-browser";
import { SocialAuthError } from "@/lib/social-auth";

WebBrowser.maybeCompleteAuthSession();

type AuthApiTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  issuedAt?: number;
  error?: string;
};

type OsmBeginResponse = AuthApiTokenResponse & {
  needs_email?: boolean;
  pending_token?: string;
  display_name?: string | null;
};

function toStoredTokens(body: AuthApiTokenResponse): StoredTokens {
  if (!body.accessToken) {
    throw new SocialAuthError(body.error ?? "Auth response missing access token");
  }
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresIn: body.expiresIn,
    tokenType: "bearer",
    scope: body.scope,
    issuedAt: body.issuedAt ?? Math.floor(Date.now() / 1000),
  };
}

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: T }> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      language: getLocale(),
      country: "SK",
    }),
  });
  const json = (await res.json()) as T;
  return { ok: res.ok, status: res.status, json };
}

function getFacebookAppId(): string {
  const id = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim();
  if (!id) {
    throw new SocialAuthError(
      "Facebook is not configured (EXPO_PUBLIC_FACEBOOK_APP_ID)",
    );
  }
  return id;
}

function getNabezkyBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_NABEZKY_BASE_URL?.trim() || "https://nabezky.sk"
  ).replace(/\/$/, "");
}

function getNabezkyClientId(): string {
  const id = process.env.EXPO_PUBLIC_NABEZKY_CLIENT_ID?.trim();
  if (!id) {
    throw new SocialAuthError(
      "Nabezky is not configured (EXPO_PUBLIC_NABEZKY_CLIENT_ID)",
    );
  }
  return id;
}

function getOsmClientId(): string {
  const id = process.env.EXPO_PUBLIC_OSM_CLIENT_ID?.trim();
  if (!id) {
    throw new SocialAuthError(
      "OpenStreetMap is not configured (EXPO_PUBLIC_OSM_CLIENT_ID)",
    );
  }
  return id;
}

export function getNabezkyRedirectUri(): string {
  return makeRedirectUri({
    scheme: "civic",
    path: "oauth/nabezky",
    native: "civic://oauth/nabezky",
  });
}

export function getOsmRedirectUri(): string {
  return makeRedirectUri({
    scheme: "civic",
    path: "oauth/openstreetmap",
    native: "civic://oauth/openstreetmap",
  });
}

export function getFacebookRedirectUri(): string {
  return makeRedirectUri({
    scheme: "civic",
    path: "oauth/facebook",
    native: "civic://oauth/facebook",
  });
}

/**
 * Facebook Login via system browser (access token) → Civic API.
 */
export async function signInWithFacebookBrowser(): Promise<StoredTokens> {
  const accessToken = await authorizeWithBrowserToken({
    clientId: getFacebookAppId(),
    redirectUri: getFacebookRedirectUri(),
    scopes: ["public_profile", "email"],
    authorizationEndpoint: "https://www.facebook.com/v21.0/dialog/oauth",
    extraParams: { display: "popup" },
  });

  const { ok, json } = await postJson<AuthApiTokenResponse>("/auth/facebook", {
    access_token: accessToken,
  });
  if (!ok) {
    throw new SocialAuthError(
      typeof json.error === "string" ? json.error : "Facebook auth failed",
    );
  }
  return toStoredTokens(json);
}

/**
 * Nabezky OIDC authorization code + PKCE → Civic API exchange.
 */
export async function signInWithNabezkyBrowser(): Promise<StoredTokens> {
  const redirectUri = getNabezkyRedirectUri();
  const base = getNabezkyBaseUrl();
  const { code, codeVerifier } = await authorizeWithBrowserCode({
    clientId: getNabezkyClientId(),
    redirectUri,
    scopes: ["openid", "email", "profile"],
    authorizationEndpoint: `${base}/oauth2/authorize`,
  });

  const { ok, json } = await postJson<AuthApiTokenResponse>("/auth/nabezky", {
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  if (!ok) {
    throw new SocialAuthError(
      typeof json.error === "string" ? json.error : "Nabezky auth failed",
    );
  }
  return toStoredTokens(json);
}

export type OsmPendingAuth = {
  pendingToken: string;
  displayName: string | null;
};

/** Returning OSM user (HybridAuth hit) or first-time email collection. */
export type OsmBeginAuthResult =
  | { kind: "signed_in"; tokens: StoredTokens }
  | { kind: "needs_email"; pending: OsmPendingAuth };

/**
 * OpenStreetMap OAuth2 PKCE → Civic.
 * Existing OSM HybridAuth link mints immediately; otherwise email is collected
 * in-app before `/auth/openstreetmap/complete`.
 */
export async function beginOpenStreetMapBrowser(): Promise<OsmBeginAuthResult> {
  const redirectUri = getOsmRedirectUri();
  const { code, codeVerifier } = await authorizeWithBrowserCode({
    clientId: getOsmClientId(),
    redirectUri,
    scopes: ["openid", "read_prefs"],
    authorizationEndpoint: "https://www.openstreetmap.org/oauth2/authorize",
  });

  const { ok, json } = await postJson<OsmBeginResponse>("/auth/openstreetmap", {
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  if (!ok) {
    throw new SocialAuthError(
      typeof json.error === "string" ? json.error : "OpenStreetMap auth failed",
    );
  }
  if (json.accessToken) {
    return { kind: "signed_in", tokens: toStoredTokens(json) };
  }
  if (json.needs_email && json.pending_token) {
    return {
      kind: "needs_email",
      pending: {
        pendingToken: json.pending_token,
        displayName:
          typeof json.display_name === "string" ? json.display_name : null,
      },
    };
  }
  throw new SocialAuthError("OpenStreetMap auth failed");
}

export async function completeOpenStreetMapEmail(
  pendingToken: string,
  email: string,
): Promise<StoredTokens> {
  const { ok, json } = await postJson<AuthApiTokenResponse>(
    "/auth/openstreetmap/complete",
    {
      pending_token: pendingToken,
      email,
    },
  );
  if (!ok) {
    throw new SocialAuthError(
      typeof json.error === "string"
        ? json.error
        : "OpenStreetMap email step failed",
    );
  }
  return toStoredTokens(json);
}
