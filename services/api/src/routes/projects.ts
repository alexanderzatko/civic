import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ProjectDetail, ProjectWorkReportPage } from "@civic/shared";
import { requireAuth } from "../auth.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    const error =
      err.status === 404
        ? "not_found"
        : err.status === 400
          ? "invalid_request"
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

function parseNid(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const nid = String(raw).trim();
  if (!/^\d+$/.test(nid) || nid === "0") return null;
  return nid;
}

export const projectsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /**
   * Project detail for in-app modal.
   * Proxies Rovas `GET /rovas/civic_project/{nid}`.
   */
  app.get(
    "/projects/:nid",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const nid = parseNid((req.params as { nid?: unknown }).nid);
      if (!nid) {
        return reply.code(400).send({
          error: "invalid_nid",
          message: "Project nid must be a positive integer.",
        });
      }

      try {
        const detail: ProjectDetail = await ctx.rovas.fetchProject(
          user.accessToken,
          nid,
        );
        return detail;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Paginated work reports for a project.
   * Proxies Rovas `GET /rovas/civic_project_work_reports?project_nid=`.
   */
  app.get(
    "/projects/:nid/work-reports",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const nid = parseNid((req.params as { nid?: unknown }).nid);
      if (!nid) {
        return reply.code(400).send({
          error: "invalid_nid",
          message: "Project nid must be a positive integer.",
        });
      }

      const q = req.query as { limit?: unknown; offset?: unknown };
      const limit =
        typeof q.limit === "string" || typeof q.limit === "number"
          ? Number(q.limit)
          : undefined;
      const offset =
        typeof q.offset === "string" || typeof q.offset === "number"
          ? Number(q.offset)
          : undefined;

      try {
        const page: ProjectWorkReportPage =
          await ctx.rovas.fetchProjectWorkReports(user.accessToken, nid, {
            ...(Number.isFinite(limit) ? { limit } : {}),
            ...(Number.isFinite(offset) ? { offset } : {}),
          });
        return page;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
