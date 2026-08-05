import type { EkasaClient } from "./ekasa.js";
import type { ApiConfig } from "./config.js";
import type Database from "better-sqlite3";
import type { RovasClient } from "./rovas-client.js";

export interface AppContext {
  config: ApiConfig;
  ekasa: EkasaClient;
  db: Database.Database;
  rovas: RovasClient;
}
