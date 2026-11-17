import { getApiBaseUrl } from "@/lib/api";
import type { StoredTokens } from "@/lib/auth-storage";
import { getLocale, t } from "@/lib/i18n";

export class PasswordAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PasswordAuthError";
  }
}

type AuthApiTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  issuedAt?: number;
  rovasUid?: number;
  error?: string;
  code?: string;
};

function toStoredTokens(body: AuthApiTokenResponse): StoredTokens {
  if (!body.accessToken) {
    throw new PasswordAuthError(
      body.error ?? "Auth response missing access token",
      body.code,
    );
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

function mapApiError(
  status: number,
  json: AuthApiTokenResponse,
): PasswordAuthError {
  const code = typeof json.code === "string" ? json.code : undefined;
  if (code === "email_taken") {
    return new PasswordAuthError(t("auth.error_email_taken"), code);
  }
  if (code === "username_taken") {
    return new PasswordAuthError(t("auth.error_username_taken"), code);
  }
  if (status === 401) {
    return new PasswordAuthError(t("auth.error_invalid_credentials"), code);
  }
  if (status === 409) {
    return new PasswordAuthError(
      typeof json.error === "string" && json.error
        ? json.error
        : t("auth.error_conflict"),
      code,
    );
  }
  return new PasswordAuthError(
    typeof json.error === "string" && json.error
      ? json.error
      : t("auth.error_generic"),
    code,
  );
}

async function postPasswordAuth(
  path: "/auth/register" | "/auth/login",
  body: Record<string, unknown>,
): Promise<StoredTokens> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as AuthApiTokenResponse;
  if (!res.ok) {
    throw mapApiError(res.status, json);
  }
  return toStoredTokens(json);
}

export async function registerWithPasswordNative(input: {
  username: string;
  email: string;
  password: string;
}): Promise<StoredTokens> {
  return postPasswordAuth("/auth/register", {
    username: input.username.trim(),
    email: input.email.trim(),
    password: input.password,
    language: getLocale(),
    country: "SK",
  });
}

export async function signInWithPasswordNative(input: {
  login: string;
  password: string;
}): Promise<StoredTokens> {
  return postPasswordAuth("/auth/login", {
    login: input.login.trim(),
    password: input.password,
  });
}
