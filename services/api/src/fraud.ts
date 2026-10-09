import type Database from "better-sqlite3";
import type { CivicSettings, ClaimReceiptErrorCode } from "@civic/shared";
import { BRATISLAVA_TZ, bratislavaDateKey } from "@civic/shared";

export { BRATISLAVA_TZ, bratislavaDateKey } from "@civic/shared";

export type FraudBlock = {
  code: ClaimReceiptErrorCode;
  message: string;
};

/** Normalize store address for same-store matching. */
export function normalizeStoreKey(
  storeAddress: string | null | undefined,
  merchantAddress: string | null | undefined,
): string | null {
  const raw = (storeAddress || merchantAddress || "").trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Start of the Bratislava calendar day containing `now`, as a UTC ISO string
 * suitable for SQLite `datetime('now')` comparisons (UTC stored).
 */
export function bratislavaDayStartUtcIso(now: Date = new Date()): string {
  const key = bratislavaDateKey(now);
  if (!key) return "1970-01-01 00:00:00";
  const localAsUtc = bratislavaWallTimeAsUtcMs(key, 0, 0, 0);
  return toSqliteUtc(new Date(localAsUtc));
}

/** Format for SQLite `datetime('now')` comparisons (`YYYY-MM-DD HH:MM:SS` UTC). */
export function toSqliteUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Convert Bratislava wall-clock Y-M-D H:M:S to UTC epoch ms. */
function bratislavaWallTimeAsUtcMs(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
): number {
  // Binary-search UTC instant whose Bratislava wall time matches.
  const [y, m, d] = dateKey.split("-").map(Number);
  // Approximate: assume CET (+1) then refine.
  let guess = Date.UTC(y, m - 1, d, hour - 1, minute, second);
  for (let i = 0; i < 4; i++) {
    const parts = bratislavaParts(new Date(guess));
    const wantMin = hour * 60 + minute;
    const gotMin = parts.hour * 60 + parts.minute;
    const dayDelta =
      Date.UTC(y, m - 1, d) -
      Date.UTC(parts.year, parts.month - 1, parts.day);
    const dayMs = dayDelta;
    const minDelta = wantMin - gotMin;
    guess += dayMs + minDelta * 60_000 + (second - parts.second) * 1000;
  }
  return guess;
}

function bratislavaParts(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BRATISLAVA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function isOutsideClaimWindow(
  purchaseAt: string | null,
  settings: CivicSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.claimWindowEnabled) return false;
  if (!purchaseAt) return false;
  const purchased = Date.parse(purchaseAt);
  if (!Number.isFinite(purchased)) return false;
  const windowMs = settings.claimWindowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - purchased > windowMs;
}

/**
 * Reject when receipt purchase calendar day (Bratislava) is strictly before
 * the user's Rovas registration calendar day.
 */
export function isPurchaseBeforeRegistration(
  purchaseAt: string | null,
  accountCreated: string | null,
): boolean {
  if (!purchaseAt || !accountCreated) return false;
  const purchaseDay = bratislavaDateKey(purchaseAt);
  const createdDay = bratislavaDateKey(accountCreated);
  if (!purchaseDay || !createdDay) return false;
  return purchaseDay < createdDay;
}

export function isStrikeBlocked(
  db: Database.Database,
  rovasUid: string,
  now: Date = new Date(),
): boolean {
  const row = db
    .prepare(
      `SELECT blocked_until FROM user_strikes WHERE rovas_uid = ?`,
    )
    .get(rovasUid) as { blocked_until: string | null } | undefined;
  if (!row?.blocked_until) return false;
  const until = Date.parse(row.blocked_until);
  if (!Number.isFinite(until)) return false;
  return until > now.getTime();
}

/**
 * Count recent duplicate outcomes and bump user_strikes.
 * When threshold is reached, set blocked_until = now + strikeBlockDays.
 */
export function recordDuplicateStrike(
  db: Database.Database,
  rovasUid: string,
  settings: CivicSettings,
  now: Date = new Date(),
): void {
  const since = toSqliteUtc(
    new Date(now.getTime() - settings.strikeWindowDays * 24 * 60 * 60 * 1000),
  );

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM claim_attempts
       WHERE submitted_by_rovas_uid = ?
         AND outcome = 'duplicate'
         AND created_at >= ?`,
    )
    .get(rovasUid, since) as { n: number };

  const strikeCount = countRow.n;
  let blockedUntil: string | null = null;
  if (strikeCount >= settings.strikeThreshold) {
    blockedUntil = new Date(
      now.getTime() + settings.strikeBlockDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  db.prepare(
    `INSERT INTO user_strikes (rovas_uid, strike_count, blocked_until, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(rovas_uid) DO UPDATE SET
       strike_count = excluded.strike_count,
       blocked_until = COALESCE(excluded.blocked_until, user_strikes.blocked_until),
       updated_at = excluded.updated_at`,
  ).run(rovasUid, strikeCount, blockedUntil);
}

export function countSameStoreClaimsSince(
  db: Database.Database,
  rovasUid: string,
  storeKey: string,
  sinceIso: string,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM claim_attempts
       WHERE submitted_by_rovas_uid = ?
         AND store_key = ?
         AND outcome = 'claimed'
         AND created_at >= ?`,
    )
    .get(rovasUid, storeKey, sinceIso) as { n: number };
  return row.n;
}

export function isSameStoreLimitExceeded(
  db: Database.Database,
  rovasUid: string,
  storeKey: string | null,
  settings: CivicSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.sameStoreDailyLimitEnabled) return false;
  if (!storeKey) return false;
  const since = bratislavaDayStartUtcIso(now);
  const n = countSameStoreClaimsSince(db, rovasUid, storeKey, since);
  return n >= settings.sameStoreDailyLimit;
}

/**
 * Soft / hard fraud evaluation shared by verify + claim.
 * Returns the first blocking reason, or null if allowed.
 */
export function evaluateClaimFraud(params: {
  settings: CivicSettings;
  db: Database.Database;
  rovasUid: string;
  vatEur: number;
  purchaseAt: string | null;
  accountCreated: string | null;
  /** When null/undefined, account-age check fails closed if we require it. */
  accountCreatedMissing: boolean;
  storeKey: string | null;
  alreadyClaimed?: boolean;
}): FraudBlock | null {
  const {
    settings,
    db,
    rovasUid,
    vatEur,
    purchaseAt,
    accountCreated,
    accountCreatedMissing,
    storeKey,
    alreadyClaimed,
  } = params;

  if (alreadyClaimed) {
    return {
      code: "duplicate",
      message: "This receipt has already been claimed on Rovas.",
    };
  }

  if (isStrikeBlocked(db, rovasUid)) {
    return {
      code: "rejected_strikes",
      message:
        "Too many duplicate claim attempts. Claiming is temporarily blocked.",
    };
  }

  if (vatEur < settings.minVatEur) {
    return {
      code: "rejected_vat",
      message: "VAT amount is below the minimum claimable threshold.",
    };
  }

  if (isOutsideClaimWindow(purchaseAt, settings)) {
    return {
      code: "rejected_window",
      message: "The claim window for this receipt has expired.",
    };
  }

  if (accountCreatedMissing) {
    return {
      code: "rejected_account_age",
      message:
        "Rovas account creation date is unavailable; cannot validate receipt age.",
    };
  }

  if (isPurchaseBeforeRegistration(purchaseAt, accountCreated)) {
    return {
      code: "rejected_account_age",
      message:
        "Receipt purchase date is before your Rovas account registration.",
    };
  }

  if (isSameStoreLimitExceeded(db, rovasUid, storeKey, settings)) {
    return {
      code: "rejected_same_store",
      message:
        "Daily limit of claims from this store address has been reached.",
    };
  }

  return null;
}
