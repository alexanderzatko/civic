import * as jose from "jose";

export type VerifiedIdToken = {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
};

export class IdTokenVerifyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 = 401,
  ) {
    super(message);
    this.name = "IdTokenVerifyError";
  }
}

const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

const APPLE_ISSUER = "https://appleid.apple.com";

let googleJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
let appleJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getGoogleJwks() {
  if (!googleJwks) {
    googleJwks = jose.createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs"),
    );
  }
  return googleJwks;
}

function getAppleJwks() {
  if (!appleJwks) {
    appleJwks = jose.createRemoteJWKSet(
      new URL("https://appleid.apple.com/auth/keys"),
    );
  }
  return appleJwks;
}

function requireEmail(
  email: unknown,
  emailVerified: boolean,
): string {
  if (typeof email !== "string" || !email.includes("@")) {
    throw new IdTokenVerifyError("ID token missing email", 400);
  }
  if (!emailVerified) {
    throw new IdTokenVerifyError("ID token email is not verified", 400);
  }
  return email;
}

/**
 * Verify a Google ID token (JWT) against Google JWKS and allowed client IDs.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  audiences: string[],
): Promise<VerifiedIdToken> {
  if (!audiences.length) {
    throw new IdTokenVerifyError("Google client IDs are not configured", 400);
  }
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(idToken, getGoogleJwks(), {
      audience: audiences,
    });
    payload = result.payload;
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error ? `Invalid Google ID token: ${err.message}` : "Invalid Google ID token",
      401,
    );
  }

  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (!GOOGLE_ISSUERS.has(iss)) {
    throw new IdTokenVerifyError("Google ID token has unexpected issuer", 401);
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new IdTokenVerifyError("Google ID token missing subject", 401);
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  const email = requireEmail(payload.email, emailVerified);
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

/**
 * Verify an Apple identity token against Apple JWKS and the app audience
 * (usually the iOS bundle id).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  audiences: string[],
): Promise<VerifiedIdToken> {
  if (!audiences.length) {
    throw new IdTokenVerifyError("Apple client IDs are not configured", 400);
  }
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(identityToken, getAppleJwks(), {
      audience: audiences,
      issuer: APPLE_ISSUER,
    });
    payload = result.payload;
  } catch (err) {
    throw new IdTokenVerifyError(
      err instanceof Error
        ? `Invalid Apple identity token: ${err.message}`
        : "Invalid Apple identity token",
      401,
    );
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new IdTokenVerifyError("Apple identity token missing subject", 401);
  }

  // Apple may omit email on subsequent sign-ins; caller may pass cached email.
  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === "true" ||
    // Apple often uses string "true"
    String(payload.email_verified).toLowerCase() === "true";

  return {
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    emailVerified: typeof payload.email === "string" ? emailVerified || true : false,
    displayName: null,
  };
}
