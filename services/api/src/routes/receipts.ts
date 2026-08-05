import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import {
  computeMerits,
  parseReceiptUid,
  splitMerits,
  type ClaimReceiptResponse,
  type VerifyReceiptResponse,
} from "@civic/shared";
import { requireAuth } from "../auth.js";
import {
  EkasaClientError,
  extractMerchantName,
  extractVatEur,
  parseFsDate,
} from "../ekasa.js";
import type { AppContext } from "../context.js";
import { RovasClientError } from "../rovas-client.js";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number().optional(),
});

const verifyBodySchema = z.object({
  qr_or_uid: z.string().min(1),
  location: locationSchema.optional(),
});

const claimBodySchema = z.object({
  qr_or_uid: z.string().min(1),
  location: locationSchema,
  shares: z
    .array(
      z.object({
        rovas_uid: z.string().min(1),
        share_pct: z.number().positive().max(100),
      }),
    )
    .optional(),
});

type ClaimAttemptOutcome =
  | "claimed"
  | "duplicate"
  | "rejected_window"
  | "rejected_rate"
  | "rejected_shares"
  | "rejected_location"
  | "rejected_vat"
  | "error";

function recordAttempt(
  ctx: AppContext,
  params: {
    receiptUid: string;
    rovasUid: string;
    outcome: ClaimAttemptOutcome;
    lat?: number;
    lng?: number;
  },
): void {
  ctx.db
    .prepare(
      `INSERT INTO claim_attempts
        (receipt_uid, submitted_by_rovas_uid, outcome, claim_lat, claim_lng)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      params.receiptUid,
      params.rovasUid,
      params.outcome,
      params.lat ?? null,
      params.lng ?? null,
    );
}

function claimError(
  reply: FastifyReply,
  status: number,
  body: Extract<ClaimReceiptResponse, { claimed: false }>,
) {
  return reply.code(status).send(body);
}

function isLocationUsable(
  loc: { lat: number; lng: number; accuracy_m?: number },
  maxAccuracyM: number,
): boolean {
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return false;
  if (loc.lat === 0 && loc.lng === 0) return false;
  if (Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180) return false;
  if (
    loc.accuracy_m != null &&
    Number.isFinite(loc.accuracy_m) &&
    loc.accuracy_m > maxAccuracyM
  ) {
    return false;
  }
  return true;
}

function countSuccessfulClaimsSince(
  ctx: AppContext,
  rovasUid: string,
  sinceIso: string,
): number {
  const row = ctx.db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM receipt_claims
       WHERE submitted_by_rovas_uid = ?
         AND created_at >= ?`,
    )
    .get(rovasUid, sinceIso) as { n: number };
  return Number(row.n) || 0;
}

function daysAgoIso(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export const receiptsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.post<{ Body: unknown }>("/receipts/verify", async (req, reply) => {
    const parsed = verifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        verified: false,
        receipt_uid: null,
        code: "invalid_uid",
        message: "qr_or_uid is required",
      } satisfies VerifyReceiptResponse);
    }

    const uid = parseReceiptUid(parsed.data.qr_or_uid);
    if (!uid) {
      return reply.code(422).send({
        verified: false,
        receipt_uid: null,
        code: "invalid_uid",
        message: "Could not extract a valid eKasa receipt UID (O- + 32 hex).",
      } satisfies VerifyReceiptResponse);
    }

    try {
      const fsResult = await ctx.ekasa.findReceipt(uid);
      if (fsResult.returnValue !== 0 || !fsResult.receipt) {
        return reply.code(404).send({
          verified: false,
          receipt_uid: uid,
          code: "not_found",
          message: "Receipt not found in the Finančná správa registry.",
        } satisfies VerifyReceiptResponse);
      }

      const receipt = fsResult.receipt;
      const vatEur = extractVatEur(receipt);
      const { settings } = ctx.config;
      const meritsPreview = computeMerits({
        vatEur,
        hourlyWageEur: settings.hourlyWageEur,
        meritsPerHour: settings.meritsPerHour,
      });

      // Optional verify location is accepted for Phase 2 drift checks;
      // Phase 1 stores nothing yet.
      void parsed.data.location;

      return {
        receipt_uid: uid,
        verified: true,
        merchant_name: extractMerchantName(receipt),
        purchase_at: parseFsDate(receipt.issueDate ?? receipt.createDate),
        total_price_eur:
          receipt.totalPrice != null ? Number(receipt.totalPrice) : null,
        vat_eur: vatEur,
        merits_preview: meritsPreview,
        hourly_wage_eur: settings.hourlyWageEur,
        formula_version: settings.formulaVersion,
        wage_basis: settings.wageBasis,
      } satisfies VerifyReceiptResponse;
    } catch (err) {
      const message =
        err instanceof EkasaClientError
          ? err.message
          : "Unexpected error calling Finančná správa";
      req.log.error({ err }, "eKasa verify failed");
      return reply.code(502).send({
        verified: false,
        receipt_uid: uid,
        code: "fs_error",
        message,
      } satisfies VerifyReceiptResponse);
    }
  });

  app.post<{ Body: unknown }>(
    "/receipts/claim",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const parsed = claimBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return claimError(reply, 400, {
          claimed: false,
          receipt_uid: null,
          code: "invalid_uid",
          message: "qr_or_uid and location are required",
        });
      }

      const { location } = parsed.data;
      const uid = parseReceiptUid(parsed.data.qr_or_uid);
      if (!uid) {
        return claimError(reply, 422, {
          claimed: false,
          receipt_uid: null,
          code: "invalid_uid",
          message: "Could not extract a valid eKasa receipt UID (O- + 32 hex).",
        });
      }

      const { settings } = ctx.config;

      if (!isLocationUsable(location, settings.maxLocationAccuracyM)) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "rejected_location",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 422, {
          claimed: false,
          receipt_uid: uid,
          code: "rejected_location",
          message:
            "A usable device location is required to claim (permission + accuracy).",
        });
      }

      const existing = ctx.db
        .prepare(`SELECT id FROM receipt_claims WHERE receipt_uid = ?`)
        .get(uid) as { id: number } | undefined;
      if (existing) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "duplicate",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 409, {
          claimed: false,
          receipt_uid: uid,
          code: "duplicate",
          message: "This receipt has already been claimed.",
        });
      }

      const dayCount = countSuccessfulClaimsSince(
        ctx,
        user.rovasUid,
        daysAgoIso(1),
      );
      const monthCount = countSuccessfulClaimsSince(
        ctx,
        user.rovasUid,
        daysAgoIso(30),
      );
      if (
        dayCount >= settings.claimRateLimitDay ||
        monthCount >= settings.claimRateLimitMonth
      ) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "rejected_rate",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 429, {
          claimed: false,
          receipt_uid: uid,
          code: "rejected_rate",
          message: "Claim rate limit exceeded.",
        });
      }

      let vatEur: number;
      let merchantName: string | null;
      let purchaseAt: string | null;
      try {
        const fsResult = await ctx.ekasa.findReceipt(uid);
        if (fsResult.returnValue !== 0 || !fsResult.receipt) {
          return claimError(reply, 404, {
            claimed: false,
            receipt_uid: uid,
            code: "not_found",
            message: "Receipt not found in the Finančná správa registry.",
          });
        }
        const receipt = fsResult.receipt;
        vatEur = extractVatEur(receipt);
        merchantName = extractMerchantName(receipt);
        purchaseAt = parseFsDate(receipt.issueDate ?? receipt.createDate);
      } catch (err) {
        req.log.error({ err }, "eKasa claim verify failed");
        const message =
          err instanceof EkasaClientError
            ? err.message
            : "Unexpected error calling Finančná správa";
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "error",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 502, {
          claimed: false,
          receipt_uid: uid,
          code: "fs_error",
          message,
        });
      }

      if (vatEur < settings.minVatEur) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "rejected_vat",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 422, {
          claimed: false,
          receipt_uid: uid,
          code: "rejected_vat",
          message: "VAT amount is below the minimum claimable threshold.",
        });
      }

      if (purchaseAt) {
        const purchased = Date.parse(purchaseAt);
        if (Number.isFinite(purchased)) {
          const ageMs = Date.now() - purchased;
          const windowMs = settings.claimWindowDays * 24 * 60 * 60 * 1000;
          if (ageMs > windowMs) {
            recordAttempt(ctx, {
              receiptUid: uid,
              rovasUid: user.rovasUid,
              outcome: "rejected_window",
              lat: location.lat,
              lng: location.lng,
            });
            return claimError(reply, 422, {
              claimed: false,
              receipt_uid: uid,
              code: "rejected_window",
              message: "The claim window for this receipt has expired.",
            });
          }
        }
      }

      const sharesInput =
        parsed.data.shares && parsed.data.shares.length > 0
          ? parsed.data.shares
          : [{ rovas_uid: user.rovasUid, share_pct: 100 }];

      const shareSum = sharesInput.reduce((s, r) => s + r.share_pct, 0);
      const uids = sharesInput.map((s) => s.rovas_uid);
      const scannerIncluded = uids.includes(user.rovasUid);
      const distinct = new Set(uids).size === uids.length;
      if (
        !scannerIncluded ||
        !distinct ||
        Math.abs(shareSum - 100) > 0.05
      ) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "rejected_shares",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 422, {
          claimed: false,
          receipt_uid: uid,
          code: "rejected_shares",
          message:
            "Invalid shares: scanner must be included, uids distinct, percentages sum to 100.",
        });
      }

      const totalMerits = computeMerits({
        vatEur,
        hourlyWageEur: settings.hourlyWageEur,
        meritsPerHour: settings.meritsPerHour,
      });

      const split = splitMerits({
        totalMerits,
        scannerRovasUid: user.rovasUid,
        shares: sharesInput.map((s) => ({
          rovasUid: s.rovas_uid,
          sharePct: s.share_pct,
        })),
      });

      try {
        const rovasResult = await ctx.rovas.claimVatReceipt(user.accessToken, {
          receipt_uid: uid,
          vat_eur: vatEur,
          total_merits: totalMerits,
          merchant_name: merchantName,
          purchase_at: purchaseAt,
          hourly_wage_eur: settings.hourlyWageEur,
          formula_version: settings.formulaVersion,
          shares: sharesInput.map((s) => ({
            rovas_uid: s.rovas_uid,
            share_pct: s.share_pct,
          })),
        });

        if (rovasResult.result !== 0) {
          recordAttempt(ctx, {
            receiptUid: uid,
            rovasUid: user.rovasUid,
            outcome: "error",
            lat: location.lat,
            lng: location.lng,
          });
          return claimError(reply, 502, {
            claimed: false,
            receipt_uid: uid,
            code: "rovas_error",
            message: rovasResult.result_explain || "Rovas rejected the claim.",
          });
        }

        const persist = ctx.db.transaction(() => {
          const insertClaim = ctx.db.prepare(
            `INSERT INTO receipt_claims (
              receipt_uid, submitted_by_rovas_uid, vat_eur, total_merits_awarded,
              merchant_name, purchase_at, hourly_wage_eur, formula_version,
              fs_verified_at, claim_lat, claim_lng, claim_location_accuracy_m
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`,
          );
          const result = insertClaim.run(
            uid,
            user.rovasUid,
            vatEur,
            rovasResult.total_merits_awarded,
            merchantName,
            purchaseAt,
            settings.hourlyWageEur,
            settings.formulaVersion,
            location.lat,
            location.lng,
            location.accuracy_m ?? null,
          );
          const claimId = Number(result.lastInsertRowid);
          const insertShare = ctx.db.prepare(
            `INSERT INTO receipt_claim_shares
              (claim_id, beneficiary_rovas_uid, share_pct, merits_awarded, rounding_residue)
             VALUES (?, ?, ?, ?, ?)`,
          );
          for (const row of split) {
            insertShare.run(
              claimId,
              row.rovasUid,
              row.sharePct,
              row.meritsAwarded,
              row.roundingResidue,
            );
          }
          recordAttempt(ctx, {
            receiptUid: uid,
            rovasUid: user.rovasUid,
            outcome: "claimed",
            lat: location.lat,
            lng: location.lng,
          });
        });
        persist();

        const body: ClaimReceiptResponse = {
          claimed: true,
          receipt_uid: uid,
          total_merits: rovasResult.total_merits_awarded,
          vat_eur: vatEur,
          merchant_name: merchantName,
          shares: split.map((s) => ({
            beneficiary_rovas_uid: s.rovasUid,
            share_pct: s.sharePct,
            merits_awarded: s.meritsAwarded,
          })),
        };
        return body;
      } catch (err) {
        if (err instanceof RovasClientError) {
          if (err.status === 409) {
            recordAttempt(ctx, {
              receiptUid: uid,
              rovasUid: user.rovasUid,
              outcome: "duplicate",
              lat: location.lat,
              lng: location.lng,
            });
            return claimError(reply, 409, {
              claimed: false,
              receipt_uid: uid,
              code: "duplicate",
              message: "This receipt has already been claimed on Rovas.",
            });
          }
          if (err.status === 401) {
            return claimError(reply, 401, {
              claimed: false,
              receipt_uid: uid,
              code: "unauthorized",
              message: err.message,
            });
          }
          recordAttempt(ctx, {
            receiptUid: uid,
            rovasUid: user.rovasUid,
            outcome: "error",
            lat: location.lat,
            lng: location.lng,
          });
          return claimError(reply, err.status === 404 ? 502 : err.status, {
            claimed: false,
            receipt_uid: uid,
            code: "rovas_error",
            message: err.message,
          });
        }
        // UNIQUE race on receipt_uid
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
          recordAttempt(ctx, {
            receiptUid: uid,
            rovasUid: user.rovasUid,
            outcome: "duplicate",
            lat: location.lat,
            lng: location.lng,
          });
          return claimError(reply, 409, {
            claimed: false,
            receipt_uid: uid,
            code: "duplicate",
            message: "This receipt has already been claimed.",
          });
        }
        req.log.error({ err }, "claim failed");
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "error",
          lat: location.lat,
          lng: location.lng,
        });
        return claimError(reply, 500, {
          claimed: false,
          receipt_uid: uid,
          code: "rovas_error",
          message: "Unexpected error while claiming receipt.",
        });
      }
    },
  );
};
