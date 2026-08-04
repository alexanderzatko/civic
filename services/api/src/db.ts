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
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipt_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_uid TEXT NOT NULL UNIQUE,
      submitted_by_rovas_uid TEXT NOT NULL,
      vat_eur REAL NOT NULL,
      total_merits_awarded REAL NOT NULL,
      merchant_name TEXT,
      purchase_at TEXT,
      hourly_wage_eur REAL NOT NULL,
      formula_version INTEGER NOT NULL,
      buyer_identifier TEXT,
      payment_method TEXT,
      fs_verified_at TEXT NOT NULL,
      claim_lat REAL,
      claim_lng REAL,
      claim_location_accuracy_m REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipt_claim_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL REFERENCES receipt_claims(id) ON DELETE CASCADE,
      beneficiary_rovas_uid TEXT NOT NULL,
      share_pct REAL NOT NULL,
      merits_awarded REAL NOT NULL,
      rounding_residue REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (claim_id, beneficiary_rovas_uid)
    );

    CREATE TABLE IF NOT EXISTS claim_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_uid TEXT NOT NULL,
      submitted_by_rovas_uid TEXT NOT NULL,
      outcome TEXT NOT NULL,
      claim_lat REAL,
      claim_lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_claims_scanner
      ON receipt_claims(submitted_by_rovas_uid);
    CREATE INDEX IF NOT EXISTS idx_shares_beneficiary
      ON receipt_claim_shares(beneficiary_rovas_uid);
    CREATE INDEX IF NOT EXISTS idx_attempts_scanner
      ON claim_attempts(submitted_by_rovas_uid, created_at);
  `);
}
