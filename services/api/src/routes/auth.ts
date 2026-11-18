import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import {
  verifyFacebookAccessToken,
  verifyFacebookAuthenticationToken,
} from "../idp-facebook.js";
import { verifyNabezkyAuthorizationCode } from "../idp-nabezky.js";
import {
  beginOsmAuthorization,
  verifyOsmPendingToken,
} from "../idp-openstreetmap.js";
import {
  IdTokenVerifyError,
  verifyAppleIdentityToken,
  verifyGoogleIdToken,
} from "../idp-verify.js";
import {
  createCivicAuthSession,
  loginCivicAuth,
  registerCivicAuth,
  RovasCivicAuthError,
  toExpoTokenPayload,
} from "../rovas-civic-auth.js";

const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .optional()
  .default("sk");

const countrySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .optional()
  .default("SK")
  .transform((c) => c.toUpperCase());

const googleBodySchema = z.object({
  id_token: z.string().min(20),
  language: languageSchema,
  country: countrySchema,
});

const appleBodySchema = z.object({
  identity_token: z.string().min(20),
  /** Apple only sends full name on the first authorization. */
  full_name: z.string().trim().min(1).max(200).optional(),
  /**
   * When Apple omits email on subsequent sign-ins, the client may pass the
   * email from a prior credential (first auth). Required for first-time signup.
   */
  email: z.string().email().optional(),
  language: languageSchema,
  country: countrySchema,
});

/** Align with Civic profile username rules. */
const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9_.-]+$/);

const registerBodySchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  language: languageSchema,
  country: countrySchema,
});

const loginBodySchema = z.object({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

const facebookBodySchema = z
  .object({
    /** Facebook Limited Login OIDC JWT. */
    authentication_token: z.string().min(20).optional(),
    /** Classic Facebook Login user access token. */
    access_token: z.string().min(20).optional(),
    language: languageSchema,
    country: countrySchema,
  })
  .refine((b) => Boolean(b.authentication_token || b.access_token), {
    message: "authentication_token or access_token required",
  });

const redirectUriSchema = z
  .string()
  .min(1)
  .refine(
    (s) => s.startsWith("civic://") || /^https?:\/\//i.test(s),
    "redirect_uri must be civic:// or https",
  );

const oauthCodeBodySchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(1),
  redirect_uri: redirectUriSchema,
  language: languageSchema,
  country: countrySchema,
});

const osmBeginBodySchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(1),
  redirect_uri: redirectUriSchema,
  language: languageSchema,
  country: countrySchema,
});

const osmCompleteBodySchema = z.object({
  pending_token: z.string().min(20),
  email: z.string().trim().email().max(254),
  language: languageSchema,
  country: countrySchema,
});

function mapAuthError(err: unknown): {
  status: number;
  error: string;
  code?: string;
} {
  if (err instanceof IdTokenVerifyError) {
    return { status: err.status, error: err.message };
  }
  if (err instanceof RovasCivicAuthError) {
    return {
      status: err.status >= 400 && err.status < 600 ? err.status : 502,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    };
  }
  return { status: 500, error: "Authentication failed" };
}

export const authRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.post("/auth/google", async (req, reply) => {
    const parsed = googleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const verified = await verifyGoogleIdToken(
        parsed.data.id_token,
        ctx.config.googleClientIds,
      );
      const session = await createCivicAuthSession(ctx.config, {
        provider: "google",
        provider_subject: verified.subject,
        email: verified.email,
        email_verified: verified.emailVerified,
        display_name: verified.displayName,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Google auth failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/apple", async (req, reply) => {
    const parsed = appleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const verified = await verifyAppleIdentityToken(
        parsed.data.identity_token,
        ctx.config.appleClientIds,
      );

      const email = verified.email || parsed.data.email || "";
      if (!email.includes("@")) {
        return reply.code(400).send({
          error:
            "Apple did not provide an email. Share your email with Civic and try again.",
        });
      }

      // Token email is Apple-verified; client-supplied email is only for
      // subsequent sign-ins when Apple omits the claim (lookup is by subject).
      const emailVerified = verified.email
        ? verified.emailVerified !== false
        : true;

      const displayName =
        parsed.data.full_name?.trim() ||
        verified.displayName ||
        null;

      const session = await createCivicAuthSession(ctx.config, {
        provider: "apple",
        provider_subject: verified.subject,
        email,
        email_verified: emailVerified,
        display_name: displayName,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Apple auth failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/facebook", async (req, reply) => {
    const parsed = facebookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const verified = parsed.data.authentication_token
        ? await verifyFacebookAuthenticationToken(
            parsed.data.authentication_token,
            ctx.config.facebookAppId,
          )
        : await verifyFacebookAccessToken(
            parsed.data.access_token!,
            ctx.config.facebookAppId,
            ctx.config.facebookAppSecret,
          );

      const session = await createCivicAuthSession(ctx.config, {
        provider: "facebook",
        provider_subject: verified.subject,
        email: verified.email,
        email_verified: verified.emailVerified,
        display_name: verified.displayName,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Facebook auth failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/nabezky", async (req, reply) => {
    const parsed = oauthCodeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const verified = await verifyNabezkyAuthorizationCode(ctx.config, {
        code: parsed.data.code,
        codeVerifier: parsed.data.code_verifier,
        redirectUri: parsed.data.redirect_uri,
      });
      const session = await createCivicAuthSession(ctx.config, {
        provider: "nabezky",
        provider_subject: verified.subject,
        email: verified.email,
        email_verified: verified.emailVerified,
        display_name: verified.displayName,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Nabezky auth failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/openstreetmap", async (req, reply) => {
    const parsed = osmBeginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      return await beginOsmAuthorization(ctx.config, {
        code: parsed.data.code,
        codeVerifier: parsed.data.code_verifier,
        redirectUri: parsed.data.redirect_uri,
        language: parsed.data.language,
        country: parsed.data.country,
      });
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "OpenStreetMap auth begin failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/openstreetmap/complete", async (req, reply) => {
    const parsed = osmCompleteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const identity = await verifyOsmPendingToken(
        ctx.config,
        parsed.data.pending_token,
      );
      const session = await createCivicAuthSession(ctx.config, {
        provider: "openstreetmap",
        provider_subject: identity.subject,
        email: parsed.data.email,
        email_verified: false,
        display_name: identity.displayName,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "OpenStreetMap auth complete failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/register", async (req, reply) => {
    const parsed = registerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const session = await registerCivicAuth(ctx.config, {
        username: parsed.data.username,
        email: parsed.data.email,
        password: parsed.data.password,
        user_language: parsed.data.language,
        user_country: parsed.data.country,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Password register failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const session = await loginCivicAuth(ctx.config, {
        login: parsed.data.login,
        password: parsed.data.password,
      });
      return toExpoTokenPayload(session);
    } catch (err) {
      const mapped = mapAuthError(err);
      req.log.warn({ err }, "Password login failed");
      return reply
        .code(mapped.status)
        .send({ error: mapped.error, ...(mapped.code ? { code: mapped.code } : {}) });
    }
  });
};
