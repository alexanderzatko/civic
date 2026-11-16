import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import {
  IdTokenVerifyError,
  verifyAppleIdentityToken,
  verifyGoogleIdToken,
} from "../idp-verify.js";
import {
  createCivicAuthSession,
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

function mapAuthError(err: unknown): { status: number; error: string } {
  if (err instanceof IdTokenVerifyError) {
    return { status: err.status, error: err.message };
  }
  if (err instanceof RovasCivicAuthError) {
    return {
      status: err.status >= 400 && err.status < 600 ? err.status : 502,
      error: err.message,
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
      return reply.code(mapped.status).send({ error: mapped.error });
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
      return reply.code(mapped.status).send({ error: mapped.error });
    }
  });
};
