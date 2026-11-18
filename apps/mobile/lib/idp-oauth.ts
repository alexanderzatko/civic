import {
  AuthRequest,
  ResponseType,
  makeRedirectUri,
  type AuthSessionResult,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/lib/api";
import { getLocale } from "@/lib/i18n";
import type { StoredTokens } from "@/lib/auth-storage";
import {
  SocialAuthCancelledError,
  SocialAuthError,
} from "@/lib/social-auth";

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

type OsmPendingResponse = {
  needs_email?: boolean;
  pending_token?: string;
  display_name?: string | null;
  error?: string;
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

type AuthSuccessResult = {
  type: "success";
  params: Record<string, string>;
  authentication: { accessToken?: string } | null;
};

function requireSuccessResult(result: AuthSessionResult): AuthSuccessResult {
  if (result.type === "cancel" || result.type === "dismiss") {
    throw new SocialAuthCancelledError();
  }
  if (result.type !== "success") {
    throw new SocialAuthError("Authorization failed");
  }
  return result as AuthSuccessResult;
}

/**
 * Facebook Login via system browser (access token) → Civic API.
 */
export async function signInWithFacebookBrowser(): Promise<StoredTokens> {
  const clientId = getFacebookAppId();
  const redirectUri = getFacebookRedirectUri();
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: ["public_profile", "email"],
    responseType: ResponseType.Token,
    usePKCE: false,
    extraParams: { display: "popup" },
  });
  await request.getAuthRequestConfigAsync();

  const result = requireSuccessResult(
    await request.promptAsync({
      authorizationEndpoint: "https://www.facebook.com/v21.0/dialog/oauth",
    }),
  );

  const accessToken =
    result.params.access_token ??
    (result as { authentication?: { accessToken?: string } }).authentication
      ?.accessToken;
  if (!accessToken) {
    throw new SocialAuthError("Facebook did not return an access token");
  }

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
  const clientId = getNabezkyClientId();
  const base = getNabezkyBaseUrl();
  const redirectUri = getNabezkyRedirectUri();
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "email", "profile"],
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  await request.getAuthRequestConfigAsync();

  const result = requireSuccessResult(
    await request.promptAsync({
      authorizationEndpoint: `${base}/oauth2/authorize`,
    }),
  );

  const code = result.params.code;
  if (!code || !request.codeVerifier) {
    throw new SocialAuthError("Nabezky authorization code missing");
  }

  const { ok, json } = await postJson<AuthApiTokenResponse>("/auth/nabezky", {
    code,
    code_verifier: request.codeVerifier,
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

/**
 * OpenStreetMap OAuth2 PKCE → Civic pending token (email collected in-app).
 */
export async function beginOpenStreetMapBrowser(): Promise<OsmPendingAuth> {
  const clientId = getOsmClientId();
  const redirectUri = getOsmRedirectUri();
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "read_prefs"],
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  await request.getAuthRequestConfigAsync();

  const result = requireSuccessResult(
    await request.promptAsync({
      authorizationEndpoint: "https://www.openstreetmap.org/oauth2/authorize",
    }),
  );

  const code = result.params.code;
  if (!code || !request.codeVerifier) {
    throw new SocialAuthError("OpenStreetMap authorization code missing");
  }

  const { ok, json } = await postJson<OsmPendingResponse>("/auth/openstreetmap", {
    code,
    code_verifier: request.codeVerifier,
    redirect_uri: redirectUri,
  });
  if (!ok || !json.pending_token) {
    throw new SocialAuthError(
      typeof json.error === "string" ? json.error : "OpenStreetMap auth failed",
    );
  }
  return {
    pendingToken: json.pending_token,
    displayName:
      typeof json.display_name === "string" ? json.display_name : null,
  };
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
