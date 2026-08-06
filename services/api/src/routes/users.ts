import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { UserSearchResult } from "@civic/shared";
import { requireAuth } from "../auth.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    return reply.code(err.status).send({
      error: err.status === 503 ? "rovas_unavailable" : "rovas_error",
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
   * Proxies Rovas `GET /rovas/users_search?q=` (machine-name path).
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
};
