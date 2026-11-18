import * as jose from "jose";
import type { ApiConfig } from "./config.js";
import { IdTokenVerifyError, type VerifiedIdToken } from "./idp-verify.js";
import {
  createCivicAuthSession,
  RovasCivicAuthError,
  toExpoTokenPayload,
} from "./rovas-civic-auth.js";

const FB_LIMITED_ISSUERS = new Set([
  "https://www.facebook.com",
  "https://facebook.com",
]);

const PENDING_TYP = "civic.facebook.pending";
const PENDING_TTL_SEC = 10 * 60;

export type FacebookIdentity = {
  subject: string;
  displayName: string | null;
};

export type FacebookPendingPayload = {
  needs_email: true;
  pending_token: string;
  display_name: string | null;
};

/** Mint tokens, or ask for email when Meta omits it. */
export type FacebookBeginResult =
  | ReturnType<typeof toExpoTokenPayload>
  | FacebookPendingPayload;

let facebookJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getFacebookJwks() {
  if (!facebookJwks) {
    facebookJwks = jose.createRemoteJWKSet(
      new URL("https://www.facebook.com/.well-known/oauth/openid/jwks/"),
    );
  }
  return facebookJwks;
}

/**
 * Verify Facebook Limited Login OIDC JWT (authentication_token).
 * Email may be missing — Meta often omits it even when permission is granted.
 */
export async function verifyFacebookAuthenticationToken(
  authenticationToken: string,
  appId: string,
): Promise<VerifiedIdToken> {
  if (!appId) {
    throw new IdTokenVerifyError("Facebook App ID is not configured", 400);
  }
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(authenticationToken, getFacebookJwks(), {
      audience: appId,
    });
    payload = result.payload;
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Invalid Facebook authentication token: ${err.message}`
        : "Invalid Facebook authentication token",
      401,
    );
  }

  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (!FB_LIMITED_ISSUERS.has(iss.replace(/\/$/, ""))) {
    throw new IdTokenVerifyError("Facebook token has unexpected issuer", 401);
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new IdTokenVerifyError("Facebook token missing subject", 401);
  }

  const email =
    typeof payload.email === "string" && payload.email.includes("@")
      ? payload.email
      : "";
  const emailVerified =
    Boolean(email) &&
    (payload.email_verified === true ||
      payload.email_verified === "true" ||
      String(payload.email_verified).toLowerCase() === "true");

  const displayName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : null;

  return {
    subject: payload.sub,
    email,
    emailVerified,
    displayName,
  };
}

type DebugTokenData = {
  data?: {
    is_valid?: boolean;
    app_id?: string;
    user_id?: string;
    scopes?: string[];
  };
  error?: { message?: string };
};

type GraphMe = {
  id?: string;
  email?: string;
  name?: string;
  error?: { message?: string };
};

/**
 * Verify a classic Facebook user access token via Graph debug_token + /me.
 * Email may be omitted by Graph even when the `email` scope was granted.
 */
export async function verifyFacebookAccessToken(
  accessToken: string,
  appId: string,
  appSecret: string,
): Promise<VerifiedIdToken> {
  if (!appId || !appSecret) {
    throw new IdTokenVerifyError(
      "Facebook App ID/secret are not configured",
      400,
    );
  }

  const appToken = `${appId}|${appSecret}`;
  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", appToken);

  let debug: DebugTokenData;
  try {
    const res = await fetch(debugUrl);
    debug = (await res.json()) as DebugTokenData;
    if (!res.ok) {
      throw new Error(debug.error?.message ?? `HTTP ${res.status}`);
    }
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Facebook token debug failed: ${err.message}`
        : "Facebook token debug failed",
      401,
    );
  }

  if (
    !debug.data?.is_valid ||
    debug.data.app_id !== appId ||
    !debug.data.user_id
  ) {
    throw new IdTokenVerifyError("Facebook access token is invalid", 401);
  }

  const meUrl = new URL("https://graph.facebook.com/me");
  meUrl.searchParams.set("fields", "id,email,name");
  meUrl.searchParams.set("access_token", accessToken);

  let me: GraphMe;
  try {
    const res = await fetch(meUrl);
    me = (await res.json()) as GraphMe;
    if (!res.ok || me.error) {
      throw new Error(me.error?.message ?? `HTTP ${res.status}`);
    }
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Facebook profile request failed: ${err.message}`
        : "Facebook profile request failed",
      401,
    );
  }

  const subject = me.id || debug.data.user_id;
  if (!subject) {
    throw new IdTokenVerifyError("Facebook profile missing id", 401);
  }
  const email =
    typeof me.email === "string" && me.email.includes("@") ? me.email : "";

  return {
    subject: String(subject),
    email,
    emailVerified: Boolean(email),
    displayName:
      typeof me.name === "string" && me.name.trim() ? me.name.trim() : null,
  };
}

function pendingSecret(config: ApiConfig): Uint8Array {
  // Same secret as OSM pending tokens (OSM_PENDING_JWT_SECRET).
  if (!config.osmPendingJwtSecret) {
    throw new IdTokenVerifyError(
      "OSM_PENDING_JWT_SECRET is not configured",
      400,
    );
  }
  return new TextEncoder().encode(config.osmPendingJwtSecret);
}

export async function signFacebookPendingToken(
  config: ApiConfig,
  identity: FacebookIdentity,
): Promise<string> {
  const secret = pendingSecret(config);
  return new jose.SignJWT({
    sub: identity.subject,
    display_name: identity.displayName,
  })
    .setProtectedHeader({ alg: "HS256", typ: PENDING_TYP })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SEC}s`)
    .setSubject(identity.subject)
    .sign(secret);
}

export async function verifyFacebookPendingToken(
  config: ApiConfig,
  pendingToken: string,
): Promise<FacebookIdentity> {
  const secret = pendingSecret(config);
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(pendingToken, secret, {
      algorithms: ["HS256"],
    });
    payload = result.payload;
    const typ = result.protectedHeader.typ;
    if (typ && typ !== PENDING_TYP) {
      throw new Error("unexpected token typ");
    }
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Invalid Facebook pending token: ${err.message}`
        : "Invalid Facebook pending token",
      401,
    );
  }

  const subject =
    typeof payload.sub === "string" && payload.sub ? payload.sub : "";
  if (!subject) {
    throw new IdTokenVerifyError(
      "Facebook pending token missing subject",
      401,
    );
  }
  const displayName =
    typeof payload.display_name === "string" && payload.display_name.trim()
      ? payload.display_name.trim()
      : null;
  return { subject, displayName };
}

function isFacebookEmailRequiredError(err: unknown): boolean {
  if (!(err instanceof RovasCivicAuthError)) return false;
  if (err.status === 409) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("verified email is required") ||
    msg.includes("email is required to create or link")
  );
}

/**
 * After verifying a Facebook token:
 * - mint immediately when Meta returned an email, or when Rovas already has
 *   this Facebook HybridAuth identity (empty email probe);
 * - otherwise return a pending token so Civic can collect email in-app.
 */
export async function beginFacebookAuthorization(
  config: ApiConfig,
  verified: VerifiedIdToken,
  params: { language: string; country: string },
): Promise<FacebookBeginResult> {
  if (verified.email.includes("@")) {
    const session = await createCivicAuthSession(config, {
      provider: "facebook",
      provider_subject: verified.subject,
      email: verified.email,
      email_verified: verified.emailVerified !== false,
      display_name: verified.displayName,
      user_language: params.language,
      user_country: params.country,
    });
    return toExpoTokenPayload(session);
  }

  try {
    const session = await createCivicAuthSession(config, {
      provider: "facebook",
      provider_subject: verified.subject,
      email: "",
      email_verified: false,
      display_name: verified.displayName,
      user_language: params.language,
      user_country: params.country,
    });
    return toExpoTokenPayload(session);
  } catch (err) {
    if (!isFacebookEmailRequiredError(err)) {
      throw err;
    }
  }

  const pending_token = await signFacebookPendingToken(config, {
    subject: verified.subject,
    displayName: verified.displayName,
  });
  return {
    needs_email: true,
    pending_token,
    display_name: verified.displayName,
  };
}
