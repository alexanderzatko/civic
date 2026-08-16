import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  ProjectDetail,
  ProjectShareholderPage,
  ProjectWorkReportPage,
} from "@civic/shared";
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

function parsePager(query: { limit?: unknown; offset?: unknown }) {
  const limit =
    typeof query.limit === "string" || typeof query.limit === "number"
      ? Number(query.limit)
      : undefined;
  const offset =
    typeof query.offset === "string" || typeof query.offset === "number"
      ? Number(query.offset)
      : undefined;
  return {
    ...(Number.isFinite(limit) ? { limit } : {}),
    ...(Number.isFinite(offset) ? { offset } : {}),
  };
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

      try {
        const page: ProjectWorkReportPage =
          await ctx.rovas.fetchProjectWorkReports(
            user.accessToken,
            nid,
            parsePager(req.query as { limit?: unknown; offset?: unknown }),
          );
        return page;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Paginated shareholders for a project.
   * Proxies Rovas `GET /rovas/civic_project_shareholders?project_nid=`.
   */
  app.get(
    "/projects/:nid/shareholders",
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
        const page: ProjectShareholderPage =
          await ctx.rovas.fetchProjectShareholders(
            user.accessToken,
            nid,
            parsePager(req.query as { limit?: unknown; offset?: unknown }),
          );
        return page;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );
};
