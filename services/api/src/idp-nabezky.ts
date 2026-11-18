import * as jose from "jose";
import type { ApiConfig } from "./config.js";
import { IdTokenVerifyError, type VerifiedIdToken } from "./idp-verify.js";

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  preferred_username?: string;
};

async function exchangeNabezkyCode(
  config: ApiConfig,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  if (!config.nabezkyClientId) {
    throw new IdTokenVerifyError("Nabezky client ID is not configured", 400);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.nabezkyClientId,
    code_verifier: codeVerifier,
  });
  if (config.nabezkyClientSecret) {
    body.set("client_secret", config.nabezkyClientSecret);
  }

  const url = `${config.nabezkyBaseUrl}/oauth2/token`;
  let res: Response;
  try {
    res = await fetch(url, {
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
        ? `Nabezky token exchange failed: ${err.message}`
        : "Nabezky token exchange failed",
      401,
    );
  }

  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    throw new IdTokenVerifyError(
      json.error_description || json.error || `Nabezky token HTTP ${res.status}`,
      401,
    );
  }
  return json;
}

async function getNabezkyVerifyKey(config: ApiConfig) {
  const url = `${config.nabezkyBaseUrl}/oauth2/certificates`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new IdTokenVerifyError(
      `Nabezky certificates HTTP ${res.status}`,
      401,
    );
  }
  const certs = (await res.json()) as unknown;
  if (!Array.isArray(certs) || typeof certs[0] !== "string" || !certs[0]) {
    throw new IdTokenVerifyError("Nabezky certificates response invalid", 401);
  }
  const pem = certs[0].trim();
  try {
    if (pem.includes("BEGIN CERTIFICATE")) {
      return await jose.importX509(pem, "RS256");
    }
    return await jose.importSPKI(pem, "RS256");
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Nabezky certificate import failed: ${err.message}`
        : "Nabezky certificate import failed",
      401,
    );
  }
}

async function verifyNabezkyIdToken(
  config: ApiConfig,
  idToken: string,
): Promise<VerifiedIdToken> {
  const key = await getNabezkyVerifyKey(config);
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(idToken, key, {
      audience: config.nabezkyClientId,
    });
    payload = result.payload;
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Invalid Nabezky id_token: ${err.message}`
        : "Invalid Nabezky id_token",
      401,
    );
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new IdTokenVerifyError("Nabezky id_token missing subject", 401);
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
    throw new IdTokenVerifyError("Nabezky id_token missing email", 400);
  }
  if (!emailVerified) {
    // Some oauth2_server builds omit email_verified; treat present email as OK.
    // Prefer true when claim is missing but email is present.
  }

  const displayName =
    (typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : null) ||
    (typeof payload.preferred_username === "string" &&
    payload.preferred_username.trim()
      ? payload.preferred_username.trim()
      : null);

  return {
    subject: payload.sub,
    email,
    emailVerified: emailVerified || true,
    displayName,
  };
}

async function fetchNabezkyUserInfo(
  config: ApiConfig,
  accessToken: string,
): Promise<VerifiedIdToken> {
  // Drupal registers oauth2/UserInfo; Rovas HybridAuth uses oauth2/userinfo.
  const paths = ["/oauth2/UserInfo", "/oauth2/userinfo"];
  let lastErr: Error | null = null;
  for (const path of paths) {
    try {
      const res = await fetch(`${config.nabezkyBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        lastErr = new Error(`UserInfo HTTP ${res.status}`);
        continue;
      }
      const info = (await res.json()) as UserInfo;
      if (!info.sub) {
        lastErr = new Error("UserInfo missing sub");
        continue;
      }
      const email = typeof info.email === "string" ? info.email : "";
      if (!email.includes("@")) {
        throw new IdTokenVerifyError("Nabezky UserInfo missing email", 400);
      }
      const emailVerified =
        info.email_verified === true ||
        info.email_verified === "true" ||
        String(info.email_verified).toLowerCase() === "true";
      return {
        subject: String(info.sub),
        email,
        emailVerified: emailVerified || true,
        displayName:
          (typeof info.name === "string" && info.name.trim()
            ? info.name.trim()
            : null) ||
          (typeof info.preferred_username === "string" &&
          info.preferred_username.trim()
            ? info.preferred_username.trim()
            : null),
      };
    } catch (err) {
      if (err instanceof IdTokenVerifyError) throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new IdTokenVerifyError(
    lastErr?.message ?? "Nabezky UserInfo request failed",
    401,
  );
}

/**
 * Exchange Nabezky authorization code (PKCE) and return verified identity.
 */
export async function verifyNabezkyAuthorizationCode(
  config: ApiConfig,
  params: { code: string; codeVerifier: string; redirectUri: string },
): Promise<VerifiedIdToken> {
  const tokens = await exchangeNabezkyCode(
    config,
    params.code,
    params.codeVerifier,
    params.redirectUri,
  );

  if (tokens.id_token) {
    try {
      return await verifyNabezkyIdToken(config, tokens.id_token);
    } catch {
      // Fall through to UserInfo when id_token verify fails (cert rotation, etc.).
    }
  }

  if (!tokens.access_token) {
    throw new IdTokenVerifyError(
      "Nabezky token response missing access_token and usable id_token",
      401,
    );
  }
  return fetchNabezkyUserInfo(config, tokens.access_token);
}
