import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { AppContext } from "./context.js";
import {
  introspectRovasToken,
  parseBearerAuthorization,
  rovasUidFromToken,
  RovasAuthError,
  type RovasTokenInfo,
} from "./rovas-auth.js";

export type AuthUser = {
  rovasUid: string;
  accessToken: string;
  token: RovasTokenInfo;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

async function resolveAuth(
  ctx: AppContext,
  req: FastifyRequest,
): Promise<AuthUser | null> {
  const token = parseBearerAuthorization(req.headers.authorization);
  if (!token) return null;
  const info = await introspectRovasToken(ctx.config, token);
  return {
    rovasUid: rovasUidFromToken(info),
    accessToken: token,
    token: info,
  };
}

function sendAuthError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasAuthError) {
    return reply.code(err.status).send({
      error: err.status === 503 ? "rovas_unavailable" : "unauthorized",
      message: err.message,
    });
  }
  throw err;
}

/** Require a valid Rovas Bearer token; sets `req.authUser`. */
export function requireAuth(ctx: AppContext): preHandlerHookHandler {
  return async (req, reply) => {
    try {
      const user = await resolveAuth(ctx, req);
      if (!user) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Authorization Bearer token required",
        });
      }
      req.authUser = user;
    } catch (err) {
      return sendAuthError(reply, err);
    }
  };
}

/**
 * Attach `req.authUser` when a Bearer token is present.
 * Invalid tokens still return 401 (do not ignore bad credentials).
 */
export function optionalAuth(ctx: AppContext): preHandlerHookHandler {
  return async (req, reply) => {
    try {
      req.authUser = await resolveAuth(ctx, req);
    } catch (err) {
      if (parseBearerAuthorization(req.headers.authorization)) {
        return sendAuthError(reply, err);
      }
      req.authUser = null;
    }
  };
}
