import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ContributionsSummary, MeritIndexFilters, RankDistribution } from "@civic/shared";
import { optionalAuth, requireAuth } from "../auth.js";
import { resolveCivicContentLang } from "../content-lang.js";
import { CURATED_PROJECTS } from "../projects.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

type MeSummaryResponse = ContributionsSummary & {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  scope?: string;
};

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    return reply.code(err.status).send({
      error: err.status === 503 ? "rovas_unavailable" : "rovas_error",
      message: err.message,
    });
  }
  throw err;
}

export const summaryRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /** Profile + auth smoke test: Rovas uid/username bound to the access token. */
  app.get("/me", { preHandler: [requireAuth(ctx)] }, async (req, reply) => {
    const user = req.authUser!;
    try {
      const profile = await ctx.rovas.fetchMe(user.accessToken);
      return {
        rovas_uid: user.rovasUid,
        username: profile.username,
        display_name: profile.display_name,
        total_me: profile.total_me,
        total_chr: profile.total_chr,
        language: profile.language,
        client_id: user.token.client_id,
        scope: user.token.scope ?? null,
        expires_at: user.token.expires,
      };
    } catch (err) {
      return sendRovasError(reply, err);
    }
  });

  app.get(
    "/me/contributions/summary",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      try {
        const profile = await ctx.rovas.fetchMe(user.accessToken);
        let taxesMe = 0;
        let receiptCount = 0;
        let totalVatEur = 0;
        try {
          const claims = await ctx.rovas.fetchClaimsSummary(user.accessToken);
          taxesMe = claims.taxes_me;
          receiptCount = claims.receipt_count;
          totalVatEur = claims.total_vat_eur;
        } catch (err) {
          // Claim summary may be unavailable on older Rovas deploys — keep zeros.
          req.log.warn({ err }, "claims summary unavailable");
        }
        const body: MeSummaryResponse = {
          rovas_uid: user.rovasUid,
          username: profile.username,
          display_name: profile.display_name,
          scope: user.token.scope,
          total_me: profile.total_me,
          by_category: { taxes: taxesMe, charity: 0, volunteer: 0 },
          receipt_count: receiptCount,
          total_vat_eur: totalVatEur,
        };
        return body;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  app.get("/community/contributions/summary", async (_req, reply) => {
    try {
      const agg = await ctx.rovas.fetchAggregate();
      const body: ContributionsSummary = {
        total_me: agg.total_me,
        by_category: agg.by_category,
      };
      return reply.send(body);
    } catch (err) {
      return sendRovasError(reply, err);
    }
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
    async (req, reply) => {
      try {
        const body: RankDistribution = await ctx.rovas.fetchMeritDistribution(
          req.authUser?.accessToken,
        );
        return body;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  app.get(
    "/rank/index/countries",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q = req.query as { lang?: string };
      try {
        const lang =
          typeof q.lang === "string" ? resolveCivicContentLang(q.lang) : undefined;
        const countries = await ctx.rovas.fetchMeritIndexCountries(
          user.accessToken,
          { lang },
        );
        return { countries };
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  app.get(
    "/rank/index",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q = req.query as Record<string, string | undefined>;
      const filters: MeritIndexFilters = {
        limit: q.limit != null ? Number(q.limit) : undefined,
        offset: q.offset != null ? Number(q.offset) : undefined,
        sort: q.sort as MeritIndexFilters["sort"],
        order: q.order as MeritIndexFilters["order"],
        country_iso2: q.country_iso2,
        since_from: q.since_from,
        min_me: q.min_me != null ? Number(q.min_me) : undefined,
        max_me: q.max_me != null ? Number(q.max_me) : undefined,
        min_value_eur:
          q.min_value_eur != null ? Number(q.min_value_eur) : undefined,
        max_value_eur:
          q.max_value_eur != null ? Number(q.max_value_eur) : undefined,
        nace_section_tid:
          q.nace_section_tid != null ? Number(q.nace_section_tid) : undefined,
        source_category: q.source_category as MeritIndexFilters["source_category"],
        lang: q.lang,
      };
      try {
        return await ctx.rovas.fetchMeritIndex(user.accessToken, filters);
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
