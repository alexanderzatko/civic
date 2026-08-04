import { loadSettings, type CivicSettings } from "@civic/shared";

export interface ApiConfig {
  port: number;
  host: string;
  databasePath: string;
  ekasaReceiptFindUrl: string;
  rovasBaseUrl: string;
  settings: CivicSettings;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? "0.0.0.0",
    databasePath: env.DATABASE_PATH ?? "./data/civic.sqlite",
    ekasaReceiptFindUrl:
      env.EKASA_RECEIPT_FIND_URL ??
      "https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find",
    rovasBaseUrl: env.ROVAS_BASE_URL ?? "https://dev.rovas.app",
    settings: loadSettings(env),
  };
}
