import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { UserLookup, UserSearchResult } from "@civic/shared";
import { requireAuth } from "../auth.js";
import { resolveCivicContentLang } from "../content-lang.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    const error =
      err.status === 404
        ? "not_found"
        : err.status === 400
          ? "invalid_username"
          : err.status === 503
            ? "rovas_unavailable"
            : "rovas_error";
    return reply.code(err.status).send({
      error,
      message: err.message,
    });
  }
  throw err;
}

export const usersRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /**
   * Split-claim recipient typeahead.
   * Proxies Rovas `GET /rovas/users_search?query=` (machine-name path).
   */
  app.get(
    "/users/search",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q =
        typeof (req.query as { q?: unknown }).q === "string"
          ? (req.query as { q: string }).q.trim()
          : "";
      if (q.length < 3) {
        return reply.code(400).send({
          error: "invalid_query",
          message: "Query q must be at least 3 characters.",
        });
      }

      try {
        const results: UserSearchResult[] = await ctx.rovas.searchUsers(
          user.accessToken,
          q,
        );
        return results;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Community public profile by exact Rovas username.
   * Proxies Rovas `GET /rovas/users_lookup?username=&lang=`.
   */
  app.get(
    "/users/lookup",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q = req.query as { username?: unknown; lang?: unknown };
      const username =
        typeof q.username === "string" ? q.username.trim() : "";
      if (!username) {
        return reply.code(400).send({
          error: "invalid_username",
          message: "Query username is required.",
        });
      }

      const lang =
        typeof q.lang === "string" ? resolveCivicContentLang(q.lang) : undefined;

      try {
        const profile: UserLookup = await ctx.rovas.lookupUser(
          user.accessToken,
          username,
          { lang },
        );
        return profile;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Signed-in Merit ledger (Profil).
   * Proxies Rovas `GET /rovas/civic_merit_history?limit=&offset=&lang=`.
   */
  app.get(
    "/users/me/merit-history",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q = req.query as {
        limit?: unknown;
        offset?: unknown;
        lang?: unknown;
      };
      const limit =
        typeof q.limit === "string" || typeof q.limit === "number"
          ? Number(q.limit)
          : undefined;
      const offset =
        typeof q.offset === "string" || typeof q.offset === "number"
          ? Number(q.offset)
          : undefined;
      const lang =
        typeof q.lang === "string" ? resolveCivicContentLang(q.lang) : undefined;

      try {
        return await ctx.rovas.fetchMeritHistory(user.accessToken, {
          ...(Number.isFinite(limit) ? { limit } : {}),
          ...(Number.isFinite(offset) ? { offset } : {}),
          lang,
        });
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
