import type { FastifyPluginAsync } from "fastify";
import type { ContributionsSummary, RankDistribution } from "@civic/shared";
import { CURATED_PROJECTS } from "../projects.js";
import type { AppContext } from "../context.js";

export const summaryRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
) => {
  app.get("/me/contributions/summary", async (_req, reply) => {
    // Phase 1: no auth yet — return empty taxes-only shape.
    const body: ContributionsSummary = {
      total_me: 0,
      by_category: { taxes: 0, charity: 0, volunteer: 0 },
      receipt_count: 0,
      total_vat_eur: 0,
    };
    return reply.send(body);
  });

  app.get("/community/contributions/summary", async (_req, reply) => {
    // Placeholder until Rovas aggregate endpoint lands.
    const body: ContributionsSummary = {
      total_me: 0,
      by_category: { taxes: 0, charity: 0, volunteer: 0 },
    };
    return reply.send(body);
  });

  app.get("/charities/projects", async (req, reply) => {
    const q = req.query as { type?: string };
    const type = q.type === "invest" ? "invest" : "charity";
    return reply.send({
      projects: CURATED_PROJECTS.filter((p) => p.type === type),
    });
  });

  app.get("/rank/distribution", async (_req, reply) => {
    // Placeholder histogram until Rovas Merit Distribution is proxied.
    const body: RankDistribution = {
      buckets: [
        { label: "0–10", count: 120 },
        { label: "10–100", count: 80 },
        { label: "100–1k", count: 40 },
        { label: "1k–10k", count: 15 },
        { label: "10k+", count: 5 },
      ],
    };
    return reply.send(body);
  });

  app.get("/users/lookup", async (_req, reply) => {
    return reply.code(501).send({
      error: "not_implemented",
      message: "User lookup ships in Phase 3+.",
    });
  });
};
