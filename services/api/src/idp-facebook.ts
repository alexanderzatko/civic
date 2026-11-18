import * as jose from "jose";
import { IdTokenVerifyError, type VerifiedIdToken } from "./idp-verify.js";

const FB_LIMITED_ISSUERS = new Set([
  "https://www.facebook.com",
  "https://facebook.com",
]);

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

  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === "true" ||
    String(payload.email_verified).toLowerCase() === "true";
  const email =
    typeof payload.email === "string" && payload.email.includes("@")
      ? payload.email
      : "";
  if (!email) {
    throw new IdTokenVerifyError("Facebook token missing email", 400);
  }
  if (!emailVerified) {
    throw new IdTokenVerifyError("Facebook email is not verified", 400);
  }

  const displayName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : null;

  return {
    subject: payload.sub,
    email,
    emailVerified: true,
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
  const email = typeof me.email === "string" ? me.email : "";
  if (!email.includes("@")) {
    throw new IdTokenVerifyError(
      "Facebook did not provide an email. Grant email permission and try again.",
      400,
    );
  }

  return {
    subject: String(subject),
    email,
    emailVerified: true,
    displayName:
      typeof me.name === "string" && me.name.trim() ? me.name.trim() : null,
  };
}
