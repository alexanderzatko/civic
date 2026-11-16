import { loadSettings, type CivicSettings } from "@civic/shared";

function splitCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ApiConfig {
  port: number;
  host: string;
  databasePath: string;
  ekasaReceiptFindUrl: string;
  rovasBaseUrl: string;
  /** Classic API-KEY for Civic technical account (civic_auth_session). */
  rovasApiKey: string;
  /** Classic TOKEN for Civic technical account (civic_auth_session). */
  rovasApiToken: string;
  /** Allowed Google OAuth client IDs (iOS / Android / web) for ID-token aud. */
  googleClientIds: string[];
  /** Allowed Apple audiences (usually iOS bundle id). */
  appleClientIds: string[];
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
    rovasApiKey: env.ROVAS_API_KEY?.trim() ?? "",
    rovasApiToken: env.ROVAS_TOKEN?.trim() ?? "",
    googleClientIds: splitCsv(env.GOOGLE_CLIENT_IDS),
    appleClientIds: splitCsv(
      env.APPLE_CLIENT_IDS ?? env.APPLE_BUNDLE_ID ?? "app.civic.mobile",
    ),
    settings: loadSettings(env),
  };
}
