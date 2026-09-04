import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  CreateProjectResponse,
  ProjectDetail,
  ProjectShareholderPage,
  ProjectWorkReportPage,
  VolunteerProjectRow,
} from "@civic/shared";
import { optionalAuth, requireAuth } from "../auth.js";
import { resolveCivicContentLang } from "../content-lang.js";
import type { AppContext } from "../context.js";
import {
  RovasClientError,
  volunteerErrorCodeFromRovas,
} from "../rovas-client.js";

function sendRovasError(reply: FastifyReply, err: unknown) {
  if (err instanceof RovasClientError) {
    const error =
      err.status === 404
        ? "not_found"
        : err.status === 400
          ? "invalid_request"
          : err.status === 403
            ? volunteerErrorCodeFromRovas(err)
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

function parseLang(query: { lang?: unknown }): "sk" | "en" | undefined {
  return typeof query.lang === "string"
    ? resolveCivicContentLang(query.lang)
    : undefined;
}

export const projectsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /**
   * Up to 3 projects where the signed-in user filed work reports most recently.
   * Proxies Rovas `GET /rovas/civic_my_projects?lang=`.
   */
  app.get(
    "/projects/mine",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      try {
        const projects: VolunteerProjectRow[] = await ctx.rovas.fetchMyProjects(
          user.accessToken,
          { lang: parseLang(req.query as { lang?: unknown }) },
        );
        return { projects };
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Project title typeahead. Civic `?q=` → Rovas `query`.
   */
  app.get(
    "/projects/search",
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
        const projects: VolunteerProjectRow[] = await ctx.rovas.searchProjects(
          user.accessToken,
          q,
          { lang: parseLang(req.query as { lang?: unknown }) },
        );
        return { projects };
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Create a Public for-sale project.
   * Proxies Rovas `POST /rovas/civic_create_project`.
   */
  app.post(
    "/projects",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as {
        name?: unknown;
        description?: unknown;
        url?: unknown;
      };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!name || !description) {
        const res: CreateProjectResponse = {
          ok: false,
          error: "invalid_input",
          message: "name and description are required.",
        };
        return reply.code(400).send(res);
      }
      try {
        const created = await ctx.rovas.createProject(user.accessToken, {
          name,
          description,
          ...(url ? { url } : {}),
        });
        const res: CreateProjectResponse = {
          ok: true,
          project_nid: created.project_nid,
        };
        return res;
      } catch (err) {
        if (err instanceof RovasClientError) {
          const res: CreateProjectResponse = {
            ok: false,
            error:
              err.status === 401
                ? "unauthorized"
                : err.status === 400
                  ? "invalid_input"
                  : "rovas_error",
            message: err.message,
          };
          return reply.code(err.status === 401 ? 401 : err.status === 400 ? 400 : 502).send(res);
        }
        throw err;
      }
    },
  );

  /**
   * Project detail for in-app modal.
   * Proxies Rovas `GET /rovas/civic_project/{nid}?lang=`.
   * Optional Bearer — anonymous allowed for approved charitable projects.
   */
  app.get(
    "/projects/:nid",
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
      const nid = parseNid((req.params as { nid?: unknown }).nid);
      if (!nid) {
        return reply.code(400).send({
          error: "invalid_nid",
          message: "Project nid must be a positive integer.",
        });
      }

      try {
        const detail: ProjectDetail = await ctx.rovas.fetchProject(
          req.authUser?.accessToken,
          nid,
          { lang: parseLang(req.query as { lang?: unknown }) },
        );
        return detail;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Paginated work reports for a project.
   * Proxies Rovas `GET /rovas/civic_project_work_reports?project_nid=&lang=`.
   * Optional Bearer — anonymous allowed for approved charitable projects.
   */
  app.get(
    "/projects/:nid/work-reports",
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
      const nid = parseNid((req.params as { nid?: unknown }).nid);
      if (!nid) {
        return reply.code(400).send({
          error: "invalid_nid",
          message: "Project nid must be a positive integer.",
        });
      }

      const query = req.query as {
        limit?: unknown;
        offset?: unknown;
        lang?: unknown;
      };
      try {
        const page: ProjectWorkReportPage =
          await ctx.rovas.fetchProjectWorkReports(
            req.authUser?.accessToken,
            nid,
            {
              ...parsePager(query),
              lang: parseLang(query),
            },
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
   * Optional Bearer — anonymous allowed for approved charitable projects.
   */
  app.get(
    "/projects/:nid/shareholders",
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
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
            req.authUser?.accessToken,
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
