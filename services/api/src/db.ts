import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDatabase(databasePath: string): Database.Database {
  const dir = path.dirname(databasePath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  // Claim identity lives on Rovas ({civic_claims}); drop any leftover local
  // claim registry from earlier MVP schemas.
  db.exec(`
    DROP TABLE IF EXISTS receipt_claim_shares;
    DROP TABLE IF EXISTS receipt_claims;

    CREATE TABLE IF NOT EXISTS claim_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_uid TEXT NOT NULL,
      submitted_by_rovas_uid TEXT NOT NULL,
      outcome TEXT NOT NULL,
      claim_lat REAL,
      claim_lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_scanner
      ON claim_attempts(submitted_by_rovas_uid, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_claimed
      ON claim_attempts(submitted_by_rovas_uid, outcome, created_at);
  `);
}
