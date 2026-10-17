import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

export const commentNoticesRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.get(
    "/comment-notices/pending",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      try {
        return await ctx.rovas.fetchPendingCommentNotices(user.accessToken);
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
};
