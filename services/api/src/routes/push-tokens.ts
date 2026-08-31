import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth.js";
import type { AppContext } from "../context.js";

export const pushTokensRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.post(
    "/push-tokens",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const token =
        typeof body.expo_push_token === "string"
          ? body.expo_push_token.trim()
          : "";
      const platform =
        typeof body.platform === "string" ? body.platform.trim() : "";

      if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
        return reply.code(400).send({
          error: "invalid_input",
          message: "expo_push_token is required.",
        });
      }
      if (platform !== "ios" && platform !== "android") {
        return reply.code(400).send({
          error: "invalid_input",
          message: "platform must be ios or android.",
        });
      }

      ctx.db
        .prepare(
          `INSERT INTO push_tokens (rovas_uid, expo_push_token, platform, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(rovas_uid, expo_push_token) DO UPDATE SET
             platform = excluded.platform,
             updated_at = datetime('now')`,
        )
        .run(user.rovasUid, token, platform);

      return { ok: true };
    },
  );

  app.delete(
    "/push-tokens",
    { preHandler: [requireAuth(ctx)] },
    async (req) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const token =
        typeof body.expo_push_token === "string"
          ? body.expo_push_token.trim()
          : "";

      if (token) {
        ctx.db
          .prepare(
            `DELETE FROM push_tokens WHERE rovas_uid = ? AND expo_push_token = ?`,
          )
          .run(user.rovasUid, token);
      } else {
        ctx.db
          .prepare(`DELETE FROM push_tokens WHERE rovas_uid = ?`)
          .run(user.rovasUid);
      }

      return { ok: true };
    },
  );
};
