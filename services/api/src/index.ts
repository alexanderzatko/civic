import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { EkasaClient } from "./ekasa.js";
import { RovasClient } from "./rovas-client.js";
import type { AppContext } from "./context.js";
import { receiptsRoutes } from "./routes/receipts.js";
import { summaryRoutes } from "./routes/summary.js";

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
    try: ["/health", "GET /me", "POST /receipts/verify"],
  }));

  app.get("/health", async () => ({
    ok: true,
    formula_version: config.settings.formulaVersion,
    wage_basis: config.settings.wageBasis,
    hourly_wage_eur: config.settings.hourlyWageEur,
    rovas_base_url: config.rovasBaseUrl,
  }));

  await app.register(receiptsRoutes, { ctx });
  await app.register(summaryRoutes, { ctx });

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
