import * as jose from "jose";
import type { ApiConfig } from "./config.js";
import { IdTokenVerifyError } from "./idp-verify.js";
import {
  createCivicAuthSession,
  RovasCivicAuthError,
  toExpoTokenPayload,
} from "./rovas-civic-auth.js";

const OSM_TOKEN = "https://www.openstreetmap.org/oauth2/token";
const OSM_USER_DETAILS =
  "https://api.openstreetmap.org/api/0.6/user/details.json";

const PENDING_TYP = "civic.osm.pending";
const PENDING_TTL_SEC = 10 * 60;

export type OsmIdentity = {
  subject: string;
  displayName: string | null;
};

export type OsmPendingPayload = {
  needs_email: true;
  pending_token: string;
  display_name: string | null;
};

/** Either mint tokens (existing HybridAuth OSM link) or ask for email. */
export type OsmBeginResult =
  | ReturnType<typeof toExpoTokenPayload>
  | OsmPendingPayload;

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type OsmUserDetailsJson = {
  user?: {
    id?: number | string;
    display_name?: string;
  };
};

async function exchangeOsmCode(
  config: ApiConfig,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<string> {
  if (!config.osmClientId) {
    throw new IdTokenVerifyError("OSM client ID is not configured", 400);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.osmClientId,
    code_verifier: codeVerifier,
  });
  if (config.osmClientSecret) {
    body.set("client_secret", config.osmClientSecret);
  }

  let res: Response;
  try {
    res = await fetch(OSM_TOKEN, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `OSM token exchange failed: ${err.message}`
        : "OSM token exchange failed",
      401,
    );
  }

  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new IdTokenVerifyError(
      json.error_description || json.error || `OSM token HTTP ${res.status}`,
      401,
    );
  }
  return json.access_token;
}

async function fetchOsmUser(accessToken: string): Promise<OsmIdentity> {
  let res: Response;
  try {
    res = await fetch(OSM_USER_DETAILS, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `OSM user details failed: ${err.message}`
        : "OSM user details failed",
      401,
    );
  }

  if (!res.ok) {
    throw new IdTokenVerifyError(`OSM user details HTTP ${res.status}`, 401);
  }

  const json = (await res.json()) as OsmUserDetailsJson;
  const id = json.user?.id;
  if (id === undefined || id === null || String(id) === "") {
    throw new IdTokenVerifyError("OSM user details missing id", 401);
  }
  const displayName =
    typeof json.user?.display_name === "string" && json.user.display_name.trim()
      ? json.user.display_name.trim()
      : null;

  return { subject: String(id), displayName };
}

function pendingSecret(config: ApiConfig): Uint8Array {
  if (!config.osmPendingJwtSecret) {
    throw new IdTokenVerifyError(
      "OSM_PENDING_JWT_SECRET is not configured",
      400,
    );
  }
  return new TextEncoder().encode(config.osmPendingJwtSecret);
}

export async function signOsmPendingToken(
  config: ApiConfig,
  identity: OsmIdentity,
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

export async function verifyOsmPendingToken(
  config: ApiConfig,
  pendingToken: string,
): Promise<OsmIdentity> {
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
        ? `Invalid OSM pending token: ${err.message}`
        : "Invalid OSM pending token",
      401,
    );
  }

  const subject =
    typeof payload.sub === "string" && payload.sub ? payload.sub : "";
  if (!subject) {
    throw new IdTokenVerifyError("OSM pending token missing subject", 401);
  }
  const displayName =
    typeof payload.display_name === "string" && payload.display_name.trim()
      ? payload.display_name.trim()
      : null;
  return { subject, displayName };
}

/**
 * Rovas should return 409 when OSM identity is unknown and email is missing.
 * Prod currently swallows that `services_error` as HTTP 500 (see Rovas task
 * civic-auth-services-error-swallow); treat both shapes as needs_email.
 */
function isOsmEmailRequiredError(err: unknown): boolean {
  if (!(err instanceof RovasCivicAuthError)) return false;
  if (err.status === 409) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("verified email is required") ||
    msg.includes("email is required to create or link")
  );
}

/**
 * Exchange OSM authorization code, then:
 * - mint immediately when Rovas already has this OpenStreetMap HybridAuth
 *   identity (returning login → Home signed in, no email step);
 * - otherwise return a pending token so Civic can collect email and complete.
 */
export async function beginOsmAuthorization(
  config: ApiConfig,
  params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    language: string;
    country: string;
  },
): Promise<OsmBeginResult> {
  const accessToken = await exchangeOsmCode(
    config,
    params.code,
    params.codeVerifier,
    params.redirectUri,
  );
  const identity = await fetchOsmUser(accessToken);

  try {
    const session = await createCivicAuthSession(config, {
      provider: "openstreetmap",
      provider_subject: identity.subject,
      // Empty: Rovas mints on HybridAuth hit; 409 when identity is new.
      email: "",
      email_verified: false,
      display_name: identity.displayName,
      user_language: params.language,
      user_country: params.country,
    });
    return toExpoTokenPayload(session);
  } catch (err) {
    if (!isOsmEmailRequiredError(err)) {
      throw err;
    }
  }

  const pending_token = await signOsmPendingToken(config, identity);
  return {
    needs_email: true,
    pending_token,
    display_name: identity.displayName,
  };
}
