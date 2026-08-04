import type { EkasaClient } from "./ekasa.js";
import type { ApiConfig } from "./config.js";
import type Database from "better-sqlite3";

export interface AppContext {
  config: ApiConfig;
  ekasa: EkasaClient;
  db: Database.Database;
}
