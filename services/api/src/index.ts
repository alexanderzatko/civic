import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { EkasaClient } from "./ekasa.js";
import { resolveMeritRate } from "./merit-rate.js";
import { RovasClient } from "./rovas-client.js";
import type { AppContext } from "./context.js";
import { receiptsRoutes } from "./routes/receipts.js";
import { summaryRoutes } from "./routes/summary.js";
import { usersRoutes } from "./routes/users.js";
import { projectsRoutes } from "./routes/projects.js";
import { workReportsRoutes } from "./routes/work-reports.js";
import { verificationsRoutes } from "./routes/verifications.js";
import { pushTokensRoutes } from "./routes/push-tokens.js";

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const ekasa = new EkasaClient(config.ekasaReceiptFindUrl);
  const rovas = new RovasClient(config.rovasBaseUrl);
  const ctx: AppContext = { config, ekasa, db, rovas };

  const app = Fastify({ logger: true });

  // Ensure authUser exists on every request (hooks set it when used).
  app.decorateRequest("authUser", null);

  app.get("/", async () => ({
    service: "civic-api",
    ok: true,
    try: [
      "/health",
      "GET /merit-rate",
      "GET /me",
      "POST /receipts/verify",
      "POST /receipts/claim",
      "GET /receipts",
      "GET /receipts/fs-detail",
      "GET /users/search",
      "GET /users/lookup",
      "GET /users/me/merit-history",
      "GET /rank/index",
      "GET /projects/:nid",
      "GET /projects/:nid/work-reports",
      "GET /projects/:nid/shareholders",
      "GET /projects/mine",
      "GET /projects/search",
      "POST /projects",
      "GET /nace",
      "POST /nace/classify",
      "POST /work-reports",
      "GET /work-reports/:nid",
      "GET /work-reports/map-config",
      "GET /verifications/pending",
      "POST /verifications/:slot_nid",
      "POST /push-tokens",
      "DELETE /push-tokens",
    ],
  }));

  app.get("/health", async () => {
    const rate = await resolveMeritRate(rovas, config.settings);
    return {
      ok: true,
      formula_version: rate.formula_version,
      wage_basis: rate.wage_basis,
      hourly_wage_eur: rate.hourly_wage_eur,
      merit_rate_source: rate.source,
      rovas_base_url: config.rovasBaseUrl,
    };
  });

  /** Public Merit conversion inputs (Rovas national rate with Civic fallback). */
  app.get("/merit-rate", async () => {
    return resolveMeritRate(rovas, config.settings);
  });

  await app.register(receiptsRoutes, { ctx });
  await app.register(summaryRoutes, { ctx });
  await app.register(usersRoutes, { ctx });
  await app.register(projectsRoutes, { ctx });
  await app.register(workReportsRoutes, { ctx });
  await app.register(verificationsRoutes, { ctx });
  await app.register(pushTokensRoutes, { ctx });

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
