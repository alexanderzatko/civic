import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import type {
  ContributionsSummary,
  CreateCharityOrgResponse,
  MeritIndexFilters,
  MeritSpotlightFilters,
  MeritSpotlightPeriod,
  RankDistribution,
} from "@civic/shared";
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

const createCharityOrgBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "country must be ISO alpha-2")
    .transform((v) => v.toUpperCase()),
  website_url: z
    .string()
    .trim()
    .url()
    .refine(
      (u) => /^https?:\/\//i.test(u),
      "website_url must be http(s)",
    ),
  contact_email: z.string().trim().email().max(254),
  org_id: z.string().trim().min(1).max(64),
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine(
      (v) => /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v),
      "iban format invalid",
    ),
});

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
        receipt_history_retention: profile.receipt_history_retention,
        me_sources_share: profile.me_sources_share,
        trusted_user: profile.trusted_user,
        trusted_notify: profile.trusted_notify,
        client_id: user.token.client_id,
        scope: user.token.scope ?? null,
        expires_at: user.token.expires,
      };
    } catch (err) {
      return sendRovasError(reply, err);
    }
  });

  /**
   * Permanently dismiss Trusted congratulations banner.
   * Proxies Rovas `POST /rovas/civic_dismiss_trusted_notify`.
   */
  app.post(
    "/me/dismiss-trusted-notify",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      try {
        return await ctx.rovas.dismissTrustedNotify(user.accessToken);
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Set receipt scanning-history retention (keep vs 90-day policy).
   * Proxies Rovas `POST /rovas/civic_receipt_history_preference`.
   */
  app.post(
    "/me/receipt-history-preference",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as { retention?: unknown };
      const retention =
        body.retention === "keep" || body.retention === "policy"
          ? body.retention
          : null;
      if (!retention) {
        return reply.code(422).send({
          error: "invalid_input",
          message: 'Body must include retention: "keep" | "policy".',
        });
      }
      try {
        return await ctx.rovas.setReceiptHistoryPreference(
          user.accessToken,
          retention,
        );
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Set ME sources share preference (everyone | reciprocal | aggregate).
   * Proxies Rovas `POST /rovas/civic_me_sources_preference`.
   */
  app.post(
    "/me/me-sources-preference",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as { share?: unknown };
      const share =
        body.share === "everyone" ||
        body.share === "reciprocal" ||
        body.share === "aggregate"
          ? body.share
          : null;
      if (!share) {
        return reply.code(422).send({
          error: "invalid_input",
          message:
            'Body must include share: "everyone" | "reciprocal" | "aggregate".',
        });
      }
      try {
        return await ctx.rovas.setMeSourcesPreference(user.accessToken, share);
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Convert Chrons to Merits (1:1).
   * Proxies Rovas `POST /rovas/civic_give_chrons`.
   */
  app.post(
    "/me/give-chrons",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as { amount?: unknown };
      const raw =
        typeof body.amount === "number"
          ? body.amount
          : typeof body.amount === "string"
            ? Number(body.amount.replace(",", "."))
            : NaN;
      if (!Number.isFinite(raw) || raw <= 0) {
        return reply.code(422).send({
          error: "invalid_input",
          message: "Body must include a positive amount of Chrons.",
        });
      }
      try {
        return await ctx.rovas.giveChrons(user.accessToken, raw);
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

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
    const q = req.query as {
      type?: string;
      query?: string;
      limit?: string;
      lang?: string;
    };
    const type = q.type === "invest" ? "invest" : "charity";

    if (type === "invest") {
      const projects = CURATED_PROJECTS.filter((p) => p.type === "invest");
      return reply.send({ projects, total: projects.length });
    }

    try {
      const lang =
        typeof q.lang === "string" ? resolveCivicContentLang(q.lang) : undefined;
      const limit =
        q.limit != null && Number.isFinite(Number(q.limit))
          ? Number(q.limit)
          : undefined;
      const search =
        typeof q.query === "string" && q.query.trim() ? q.query.trim() : undefined;
      const body = await ctx.rovas.fetchCharityProjects({
        lang,
        query: search,
        limit,
      });
      return reply.send(body);
    } catch (err) {
      return sendRovasError(reply, err);
    }
  });

  /**
   * Donor-add public-benefit / nonprofit organisation.
   * Proxies Rovas `POST /rovas/civic_create_charity_org`.
   */
  app.post(
    "/charities/organizations",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const parsed = createCharityOrgBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const res: CreateCharityOrgResponse = {
          ok: false,
          error: "invalid_input",
          message: parsed.error.issues[0]?.message ?? "Invalid input.",
        };
        return reply.code(400).send(res);
      }
      try {
        const created = await ctx.rovas.createCharityOrg(
          user.accessToken,
          parsed.data,
        );
        return created;
      } catch (err) {
        if (err instanceof RovasClientError) {
          const res: CreateCharityOrgResponse = {
            ok: false,
            error:
              err.status === 401
                ? "unauthorized"
                : err.status === 400
                  ? "invalid_input"
                  : "rovas_error",
            message: err.message,
          };
          return reply
            .code(
              err.status === 401
                ? 401
                : err.status === 400
                  ? 400
                  : 502,
            )
            .send(res);
        }
        throw err;
      }
    },
  );

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
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
      const q = req.query as { lang?: string };
      try {
        const lang =
          typeof q.lang === "string" ? resolveCivicContentLang(q.lang) : undefined;
        const countries = await ctx.rovas.fetchMeritIndexCountries(
          req.authUser?.accessToken,
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
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
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
        period: q.period as MeritIndexFilters["period"],
        lang: q.lang,
      };
      if (
        filters.period != null &&
        filters.period !== "day" &&
        filters.period !== "week" &&
        filters.period !== "month"
      ) {
        return reply.code(400).send({
          error: "invalid_period",
          message: "period must be day, week, or month",
        });
      }
      try {
        return await ctx.rovas.fetchMeritIndex(
          req.authUser?.accessToken,
          filters,
        );
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  app.get(
    "/rank/spotlight",
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
      const q = req.query as Record<string, string | undefined>;
      const period = (q.period ?? "week") as MeritSpotlightPeriod;
      if (
        period !== "today" &&
        period !== "day" &&
        period !== "week" &&
        period !== "month"
      ) {
        return reply.code(400).send({
          error: "invalid_period",
          message: "period must be today, day, week, or month",
        });
      }
      const filters: MeritSpotlightFilters = {
        period,
        country_iso2: q.country_iso2,
        lang: q.lang,
      };
      try {
        return await ctx.rovas.fetchMeritSpotlight(
          req.authUser?.accessToken,
          filters,
        );
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
