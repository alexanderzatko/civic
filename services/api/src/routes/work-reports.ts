import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  ClassifyNaceResponse,
  CreateWorkReportErrorCode,
  CreateWorkReportResponse,
  NaceNode,
  RewardKind,
  WorkReportGeoJsonGeometry,
  WorkReportPhotoInput,
} from "@civic/shared";
import { requireAuth } from "../auth.js";
import { resolveCivicContentLang } from "../content-lang.js";
import type { AppContext } from "../context.js";
import {
  RovasClientError,
  volunteerErrorCodeFromRovas,
} from "../rovas-client.js";
import { FALLBACK_WORK_REPORT_MAP_CONFIG } from "../work-report-map-config.js";
import { parseFieldLocation } from "../work-report-location.js";

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

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

function httpForVolunteerError(code: CreateWorkReportErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "not_shareholder":
    case "pending_verifications":
      return 403;
    case "project_not_found":
      return 404;
    case "rovas_error":
      return 502;
    default:
      return 400;
  }
}

function parsePhotos(raw: unknown): WorkReportPhotoInput[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "photos must be an array." };
  if (raw.length > MAX_PHOTOS) {
    return { error: `At most ${MAX_PHOTOS} photos.` };
  }
  const out: WorkReportPhotoInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { error: "Each photo needs filename, mime, and data." };
    }
    const p = item as { filename?: unknown; mime?: unknown; data?: unknown };
    const filename = typeof p.filename === "string" ? p.filename.trim() : "";
    const mime = typeof p.mime === "string" ? p.mime.trim() : "image/jpeg";
    const data = typeof p.data === "string" ? p.data.replace(/\s/g, "") : "";
    if (!filename || !data) {
      return { error: "Each photo needs filename and data." };
    }
    if (!mime.startsWith("image/")) {
      return { error: "Photos must be images." };
    }
    const approxBytes = Math.floor((data.length * 3) / 4);
    if (approxBytes > MAX_PHOTO_BYTES) {
      return { error: "Each photo must be under 4 MB." };
    }
    out.push({ filename, mime, data });
  }
  return out;
}

export const workReportsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  /**
   * Nested NACE tree for the volunteer form.
   * Proxies Rovas `GET /rovas/civic_nace_tree?lang=`.
   */
  app.get("/nace", { preHandler: [requireAuth(ctx)] }, async (req, reply) => {
    const user = req.authUser!;
    const langRaw = (req.query as { lang?: unknown }).lang;
    const lang =
      typeof langRaw === "string" ? resolveCivicContentLang(langRaw) : undefined;
    try {
      const tree: NaceNode[] = await ctx.rovas.fetchNaceTree(user.accessToken, {
        lang,
      });
      return { tree };
    } catch (err) {
      return sendRovasError(reply, err);
    }
  });

  /**
   * AI NACE classification from work description.
   * Proxies Rovas `POST /rovas/civic_ai_nace`.
   */
  app.post(
    "/nace/classify",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const projectNid =
        body.project_nid != null ? String(body.project_nid).trim() : "";
      const langRaw = typeof body.lang === "string" ? body.lang : undefined;
      const lang = langRaw ? resolveCivicContentLang(langRaw) : undefined;

      if (!description) {
        return reply.code(400).send({
          status: "error",
          nace_tid: "",
          nace_code: "",
          nace_label: "",
          title: "",
          clarifying_question: "",
          confidence: 0,
          error: "description is required.",
        } satisfies ClassifyNaceResponse);
      }

      try {
        const result = await ctx.rovas.classifyNaceFromDescription(
          user.accessToken,
          {
            description,
            lang,
            ...(projectNid && /^\d+$/.test(projectNid) && projectNid !== "0"
              ? { project_nid: projectNid }
              : {}),
          },
        );
        return result;
      } catch (err) {
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Map layers / view for volunteer work-report map proof.
   * Proxies Rovas `GET /rovas/civic_work_report_map_config`.
   */
  app.get(
    "/work-reports/map-config",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      try {
        return await ctx.rovas.fetchWorkReportMapConfig(user.accessToken);
      } catch (err) {
        if (err instanceof RovasClientError && err.status === 404) {
          return FALLBACK_WORK_REPORT_MAP_CONFIG;
        }
        return sendRovasError(reply, err);
      }
    },
  );

  /**
   * Submit a volunteer work report.
   * Proxies Rovas `POST /rovas/civic_create_work_report`.
   */
  app.post(
    "/work-reports",
    {
      preHandler: [requireAuth(ctx)],
      bodyLimit: 12 * 1024 * 1024,
    },
    async (req, reply) => {
      const user = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectNid =
        body.project_nid != null ? String(body.project_nid).trim() : "";
      const dateStarted = Number(body.date_started);
      const hours = Number(body.hours);
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const naceTid =
        body.nace_tid != null ? String(body.nace_tid).trim() : "";
      const webUrl = typeof body.web_url === "string" ? body.web_url.trim() : "";
      const rewardKind: RewardKind =
        body.reward_kind === "merits" ? "merits" : "chrons";
      const photosOrErr = parsePhotos(body.photos);
      const fieldLocationOrErr = parseFieldLocation(body.field_location);

      const fail = (
        error: CreateWorkReportErrorCode,
        message: string,
      ): CreateWorkReportResponse => ({ ok: false, error, message });

      if (!/^\d+$/.test(projectNid) || projectNid === "0") {
        return reply
          .code(400)
          .send(fail("invalid_input", "project_nid is required."));
      }
      if (!Number.isFinite(dateStarted) || dateStarted < 1) {
        return reply
          .code(400)
          .send(fail("invalid_input", "date_started must be a unix timestamp."));
      }
      if (dateStarted * 1000 > Date.now() + 24 * 60 * 60 * 1000) {
        return reply
          .code(400)
          .send(fail("invalid_input", "Work date cannot be in the future."));
      }
      if (!Number.isFinite(hours) || hours <= 0) {
        return reply
          .code(400)
          .send(fail("invalid_input", "hours must be greater than 0."));
      }
      if (!description) {
        return reply
          .code(400)
          .send(fail("invalid_input", "description is required."));
      }
      if (!/^\d+$/.test(naceTid) || naceTid === "0") {
        return reply
          .code(400)
          .send(fail("invalid_input", "nace_tid is required."));
      }
      if ("error" in photosOrErr) {
        return reply.code(400).send(fail("invalid_input", photosOrErr.error));
      }
      if (fieldLocationOrErr && "error" in fieldLocationOrErr) {
        return reply
          .code(400)
          .send(fail("invalid_input", fieldLocationOrErr.error));
      }
      const fieldLocation = fieldLocationOrErr as WorkReportGeoJsonGeometry | null;
      if (!webUrl && photosOrErr.length === 0 && !fieldLocation) {
        return reply
          .code(400)
          .send(
            fail(
              "invalid_input",
              "Provide a proof URL, at least one photo, and/or a map location.",
            ),
          );
      }

      try {
        const created = await ctx.rovas.createWorkReport(user.accessToken, {
          project_nid: projectNid,
          date_started: Math.floor(dateStarted),
          hours,
          description,
          nace_tid: naceTid,
          reward_kind: rewardKind,
          ...(title ? { title } : {}),
          ...(webUrl ? { web_url: webUrl } : {}),
          ...(photosOrErr.length > 0 ? { photos: photosOrErr } : {}),
          ...(fieldLocation ? { field_location: fieldLocation } : {}),
        });
        const res: CreateWorkReportResponse = {
          ok: true,
          work_report_nid: created.work_report_nid,
          reward_kind: created.reward_kind,
        };
        return res;
      } catch (err) {
        if (err instanceof RovasClientError) {
          const error = volunteerErrorCodeFromRovas(err);
          const res: CreateWorkReportResponse = {
            ok: false,
            error,
            message: err.message,
          };
          return reply.code(httpForVolunteerError(error)).send(res);
        }
        throw err;
      }
    },
  );
};
