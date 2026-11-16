import type { ApiConfig } from "./config.js";

export type CivicAuthProvider = "google" | "apple";

export type CivicAuthSessionRequest = {
  provider: CivicAuthProvider;
  provider_subject: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  user_language: string;
  user_country: string;
};

export type CivicAuthSessionResponse = {
  rovas_uid: number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export class RovasCivicAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RovasCivicAuthError";
  }
}

/**
 * Trusted create/link + OAuth mint via Rovas
 * `POST /rovas/civic_auth_session` (see civic-native-auth-bridge task).
 */
export async function createCivicAuthSession(
  config: ApiConfig,
  body: CivicAuthSessionRequest,
): Promise<CivicAuthSessionResponse> {
  const apiKey = config.rovasApiKey;
  const token = config.rovasApiToken;
  if (!apiKey || !token) {
    throw new RovasCivicAuthError(
      "Rovas partner API credentials are not configured",
      503,
    );
  }

  const base = config.rovasBaseUrl.replace(/\/$/, "");
  const url = `${base}/rovas/civic_auth_session`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "API-KEY": apiKey,
        TOKEN: token,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RovasCivicAuthError("Rovas civic_auth_session unreachable", 503);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 240);
    } catch {
      // ignore
    }
    const status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw new RovasCivicAuthError(
      detail
        ? `Rovas civic_auth_session failed (${res.status}): ${detail}`
        : `Rovas civic_auth_session failed (${res.status})`,
      status === 401 || status === 403 || status === 409 || status === 400
        ? status
        : status >= 500
          ? 503
          : 502,
    );
  }

  const json = (await res.json()) as Partial<CivicAuthSessionResponse>;
  if (
    typeof json.access_token !== "string" ||
    !json.access_token ||
    typeof json.refresh_token !== "string" ||
    !json.refresh_token ||
    typeof json.rovas_uid !== "number"
  ) {
    throw new RovasCivicAuthError(
      "Rovas civic_auth_session response missing tokens",
      502,
    );
  }

  return {
    rovas_uid: json.rovas_uid,
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in:
      typeof json.expires_in === "number" && json.expires_in > 0
        ? json.expires_in
        : 3600,
    token_type:
      typeof json.token_type === "string" ? json.token_type : "bearer",
    scope: typeof json.scope === "string" ? json.scope : "user_profile",
  };
}

/** Map Rovas mint JSON → Expo TokenResponseConfig field names. */
export function toExpoTokenPayload(session: CivicAuthSessionResponse) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    tokenType: "bearer",
    scope: session.scope ?? "user_profile",
    issuedAt: Math.floor(Date.now() / 1000),
    rovasUid: session.rovas_uid,
  };
}
