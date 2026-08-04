import type { ApiConfig } from "./config.js";

export type RovasTokenInfo = {
  client_id: string;
  /** Drupal uid (numeric string or number from oauth2_server). */
  user_id: string | number | null;
  access_token: string;
  expires: number;
  scope?: string;
};

export class RovasAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 503 = 401,
  ) {
    super(message);
    this.name = "RovasAuthError";
  }
}

/**
 * Validate a Rovas OAuth2 access token via GET /oauth2/tokens/{token}.
 * Returns token metadata including Drupal `user_id` (uid).
 */
export async function introspectRovasToken(
  config: ApiConfig,
  accessToken: string,
): Promise<RovasTokenInfo> {
  const base = config.rovasBaseUrl.replace(/\/$/, "");
  const url = `${base}/oauth2/tokens/${encodeURIComponent(accessToken)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new RovasAuthError("Rovas token introspection unreachable", 503);
  }

  if (res.status === 404) {
    throw new RovasAuthError("Invalid or expired Rovas access token", 401);
  }
  if (!res.ok) {
    throw new RovasAuthError(
      `Rovas token introspection failed (${res.status})`,
      res.status >= 500 ? 503 : 401,
    );
  }

  const body = (await res.json()) as RovasTokenInfo;
  if (!body?.access_token || body.user_id === null || body.user_id === undefined) {
    throw new RovasAuthError("Rovas token response missing user_id", 401);
  }
  if (typeof body.expires === "number" && body.expires <= Math.floor(Date.now() / 1000)) {
    throw new RovasAuthError("Rovas access token expired", 401);
  }
  return body;
}

export function parseBearerAuthorization(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return m?.[1] ?? null;
}

export function rovasUidFromToken(info: RovasTokenInfo): string {
  return String(info.user_id);
}
