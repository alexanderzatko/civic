import type { FastifyPluginAsync } from "fastify";
import type { ContributionsSummary, RankDistribution } from "@civic/shared";
import { optionalAuth, requireAuth } from "../auth.js";
import { CURATED_PROJECTS } from "../projects.js";
import type { AppContext } from "../context.js";

type MeSummaryResponse = ContributionsSummary & {
  rovas_uid: string;
  scope?: string;
};

export const summaryRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /** Prove Bearer auth: returns the Rovas uid bound to the access token. */
  app.get("/me", { preHandler: [requireAuth(ctx)] }, async (req) => {
    const user = req.authUser!;
    return {
      rovas_uid: user.rovasUid,
      client_id: user.token.client_id,
      scope: user.token.scope ?? null,
      expires_at: user.token.expires,
    };
  });

  app.get(
    "/me/contributions/summary",
    { preHandler: [requireAuth(ctx)] },
    async (req) => {
      const user = req.authUser!;
      const row = ctx.db
        .prepare(
          `SELECT
             COALESCE(SUM(total_merits_awarded), 0) AS total_me,
             COUNT(*) AS receipt_count,
             COALESCE(SUM(vat_eur), 0) AS total_vat_eur
           FROM receipt_claims
           WHERE submitted_by_rovas_uid = ?`,
        )
        .get(user.rovasUid) as {
        total_me: number;
        receipt_count: number;
        total_vat_eur: number;
      };

      // v1: taxes-only from Civic claims. Full Rovas wallet balance needs a
      // Bearer-capable Rovas merits read (see docs/rovas-integration.md).
      const taxes = Number(row.total_me) || 0;
      const body: MeSummaryResponse = {
        rovas_uid: user.rovasUid,
        scope: user.token.scope,
        total_me: taxes,
        by_category: { taxes, charity: 0, volunteer: 0 },
        receipt_count: Number(row.receipt_count) || 0,
        total_vat_eur: Number(row.total_vat_eur) || 0,
      };
      return body;
    },
  );

  app.get("/community/contributions/summary", async (_req, reply) => {
    // Placeholder until Rovas contributions/aggregate (or equivalent) lands.
    const body: ContributionsSummary = {
      total_me: 0,
      by_category: { taxes: 0, charity: 0, volunteer: 0 },
    };
    return reply.send(body);
  });

  app.get("/charities/projects", async (req, reply) => {
    const q = req.query as { type?: string };
    const type = q.type === "invest" ? "invest" : "charity";
    return reply.send({
      projects: CURATED_PROJECTS.filter((p) => p.type === type),
    });
  });

  app.get(
    "/rank/distribution",
    { preHandler: [optionalAuth(ctx)] },
    async (req) => {
      // Placeholder histogram until Rovas Merit Distribution is proxied.
      const body: RankDistribution = {
        buckets: [
          { label: "0–10", count: 120 },
          { label: "10–100", count: 80 },
          { label: "100–1k", count: 40 },
          { label: "1k–10k", count: 15 },
          { label: "10k+", count: 5 },
        ],
      };
      if (req.authUser) {
        body.username = `uid:${req.authUser.rovasUid}`;
      }
      return body;
    },
  );

  app.get("/users/lookup", async (_req, reply) => {
    return reply.code(501).send({
      error: "not_implemented",
      message: "User lookup ships in Phase 3+.",
    });
  });
};
