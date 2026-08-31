import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  SubmitVerificationErrorCode,
  SubmitVerificationResponse,
  VerificationVerdict,
} from "@civic/shared";
import { requireAuth } from "../auth.js";
import { resolveCivicContentLang } from "../content-lang.js";
import type { AppContext } from "../context.js";
import {
  RovasClientError,
  verificationErrorCodeFromRovas,
} from "../rovas-client.js";

function httpForVerificationError(code: SubmitVerificationErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "not_assigned":
    case "not_verifiable":
    case "cannot_decline":
      return 403;
    case "not_found":
      return 404;
    case "already_verified":
      return 409;
    case "rovas_error":
      return 502;
    default:
      return 400;
  }
}

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    const error = verificationErrorCodeFromRovas(err);
    const res: SubmitVerificationResponse = {
      ok: false,
      error,
      message: err.message,
    };
    return reply.code(httpForVerificationError(error)).send(res);
  }
  throw err;
}

export const verificationsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.get(
    "/verifications/pending",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const langRaw = (req.query as { lang?: unknown }).lang;
      const lang =
        typeof langRaw === "string" ? resolveCivicContentLang(langRaw) : undefined;
      try {
        return await ctx.rovas.fetchPendingVerifications(user.accessToken, {
          lang,
        });
      } catch (err) {
        if (err instanceof RovasClientError) {
          return reply.code(err.status).send({
            error: "rovas_error",
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  app.post(
    "/verifications/:slot_nid",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const slotNid = String((req.params as { slot_nid: string }).slot_nid).trim();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const verdictRaw =
        typeof body.verdict === "string" ? body.verdict.trim().toLowerCase() : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";
      const verifiedHours =
        body.verified_hours != null ? Number(body.verified_hours) : undefined;

      const fail = (
        error: SubmitVerificationErrorCode,
        message: string,
      ): SubmitVerificationResponse => ({ ok: false, error, message });

      if (!/^\d+$/.test(slotNid) || slotNid === "0") {
        return reply
          .code(400)
          .send(fail("invalid_input", "slot_nid is required."));
      }
      if (
        verdictRaw !== "approve" &&
        verdictRaw !== "reject" &&
        verdictRaw !== "decline"
      ) {
        return reply
          .code(400)
          .send(fail("invalid_input", "verdict must be approve, reject, or decline."));
      }
      const verdict = verdictRaw as VerificationVerdict;

      try {
        const result = await ctx.rovas.submitVerification(
          user.accessToken,
          slotNid,
          {
            verdict,
            ...(note ? { note } : {}),
            ...(verifiedHours != null && Number.isFinite(verifiedHours)
              ? { verified_hours: verifiedHours }
              : {}),
          },
        );
        const res: SubmitVerificationResponse = {
          ok: true,
          work_report_nid: result.work_report_nid,
          verdict: result.verdict,
          ...(result.verification_nid
            ? { verification_nid: result.verification_nid }
            : {}),
        };
        return res;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
