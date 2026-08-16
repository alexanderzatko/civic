import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import {
  computeMerits,
  parseReceiptUid,
  splitMerits,
  type ClaimReceiptErrorCode,
  type ClaimReceiptResponse,
  type ReceiptDetailResponse,
  type VerifyReceiptResponse,
} from "@civic/shared";
import { optionalAuth, requireAuth } from "../auth.js";
import {
  EkasaClientError,
  extractMerchantName,
  extractVatEur,
  formatFsAddress,
  normalizeReceiptDetail,
  parseFsDate,
} from "../ekasa.js";
import type { AppContext } from "../context.js";
import {
  evaluateClaimFraud,
  normalizeStoreKey,
  recordDuplicateStrike,
  type FraudBlock,
} from "../fraud.js";
import { resolveMeritRate } from "../merit-rate.js";
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
  location: locationSchema.optional(),
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
  | "rejected_strikes"
  | "rejected_account_age"
  | "rejected_same_store"
  | "error";

function outcomeFromBlock(code: ClaimReceiptErrorCode): ClaimAttemptOutcome {
  switch (code) {
    case "duplicate":
      return "duplicate";
    case "rejected_window":
      return "rejected_window";
    case "rejected_rate":
      return "rejected_rate";
    case "rejected_shares":
      return "rejected_shares";
    case "rejected_location":
      return "rejected_location";
    case "rejected_vat":
      return "rejected_vat";
    case "rejected_strikes":
      return "rejected_strikes";
    case "rejected_account_age":
      return "rejected_account_age";
    case "rejected_same_store":
      return "rejected_same_store";
    default:
      return "error";
  }
}

function recordAttempt(
  ctx: AppContext,
  params: {
    receiptUid: string;
    rovasUid: string;
    outcome: ClaimAttemptOutcome;
    lat?: number;
    lng?: number;
    storeKey?: string | null;
  },
): void {
  ctx.db
    .prepare(
      `INSERT INTO claim_attempts
        (receipt_uid, submitted_by_rovas_uid, outcome, claim_lat, claim_lng, store_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.receiptUid,
      params.rovasUid,
      params.outcome,
      params.lat ?? null,
      params.lng ?? null,
      params.storeKey ?? null,
    );
}

function claimError(
  reply: FastifyReply,
  status: number,
  body: Extract<ClaimReceiptResponse, { claimed: false }>,
) {
  return reply.code(status).send(body);
}

function statusForBlock(block: FraudBlock): number {
  if (block.code === "duplicate") return 409;
  if (block.code === "rejected_rate") return 429;
  return 422;
}

function countSuccessfulClaimsSince(
  ctx: AppContext,
  rovasUid: string,
  sinceIso: string,
): number {
  const row = ctx.db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM claim_attempts
       WHERE submitted_by_rovas_uid = ?
         AND outcome = 'claimed'
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

  /**
   * Paginated claim history for the authenticated user.
   * Proxies Rovas `GET /rovas/civic_claims?view=submitted|received`.
   */
  app.get(
    "/receipts",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const user = req.authUser!;
      const q = req.query as {
        view?: string;
        limit?: string;
        offset?: string;
      };
      const view = q.view === "received" ? "received" : "submitted";
      const limitRaw = q.limit != null ? Number(q.limit) : 50;
      const offsetRaw = q.offset != null ? Number(q.offset) : 0;
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
        : 50;
      const offset = Number.isFinite(offsetRaw)
        ? Math.max(Math.trunc(offsetRaw), 0)
        : 0;

      try {
        return await ctx.rovas.fetchClaims(user.accessToken, view, {
          limit,
          offset,
        });
      } catch (err) {
        if (err instanceof RovasClientError) {
          return reply.code(err.status).send({
            error: err.status === 503 ? "rovas_unavailable" : "rovas_error",
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  /**
   * Full Finančná správa receipt payload for history detail modal.
   * `GET /receipts/fs-detail?receipt_uid=O-…`
   */
  app.get(
    "/receipts/fs-detail",
    { preHandler: [requireAuth(ctx)] },
    async (req, reply) => {
      const q = req.query as { receipt_uid?: string };
      const raw =
        typeof q.receipt_uid === "string" ? q.receipt_uid.trim() : "";
      const uid = parseReceiptUid(raw);
      if (!uid) {
        return reply.code(422).send({
          found: false,
          receipt_uid: null,
          code: "invalid_uid",
          message: "Could not extract a valid eKasa receipt UID (O- + 32 hex).",
        } satisfies ReceiptDetailResponse);
      }

      try {
        const fsResult = await ctx.ekasa.findReceipt(uid);
        if (fsResult.returnValue !== 0 || !fsResult.receipt) {
          return reply.code(404).send({
            found: false,
            receipt_uid: uid,
            code: "not_found",
            message: "Receipt not found in the Finančná správa registry.",
          } satisfies ReceiptDetailResponse);
        }
        const detail = normalizeReceiptDetail(fsResult.receipt, uid);
        return {
          found: true as const,
          ...detail,
        } satisfies ReceiptDetailResponse;
      } catch (err) {
        if (err instanceof EkasaClientError) {
          return reply.code(502).send({
            found: false,
            receipt_uid: uid,
            code: "fs_error",
            message: err.message,
          } satisfies ReceiptDetailResponse);
        }
        throw err;
      }
    },
  );

  app.post<{ Body: unknown }>(
    "/receipts/verify",
    { preHandler: [optionalAuth(ctx)] },
    async (req, reply) => {
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

      // Optional location accepted for forward compatibility; unused in v1.
      void parsed.data.location;

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
        const purchaseAt = parseFsDate(receipt.issueDate ?? receipt.createDate);
        const merchantName = extractMerchantName(receipt);
        const storeAddress = formatFsAddress(receipt.unit);
        const merchantAddress = formatFsAddress(receipt.organization);
        const storeKey = normalizeStoreKey(storeAddress, merchantAddress);
        const rate = await resolveMeritRate(ctx.rovas, ctx.config.settings);
        const meritsPreview = computeMerits({
          vatEur,
          hourlyWageEur: rate.hourly_wage_eur,
          meritsPerHour: rate.merits_per_hour,
        });

        let alreadyClaimed = false;
        let claimAllowed = true;
        let claimBlock: FraudBlock | undefined;

        if (req.authUser?.accessToken) {
          try {
            const status = await ctx.rovas.fetchClaimStatus(
              req.authUser.accessToken,
              uid,
            );
            alreadyClaimed = status.claimed;
          } catch (err) {
            req.log.warn({ err, uid }, "Rovas claim-status check failed");
          }

          let accountCreated: string | null = null;
          let accountCreatedMissing = true;
          try {
            const me = await ctx.rovas.fetchMe(req.authUser.accessToken);
            accountCreated = me.created;
            accountCreatedMissing = me.created == null;
          } catch (err) {
            req.log.warn({ err }, "Rovas /me for soft fraud checks failed");
          }

          const block = evaluateClaimFraud({
            settings: ctx.config.settings,
            db: ctx.db,
            rovasUid: req.authUser.rovasUid,
            vatEur,
            purchaseAt,
            accountCreated,
            accountCreatedMissing,
            storeKey,
            alreadyClaimed,
          });
          if (block) {
            claimAllowed = false;
            claimBlock = block;
          }
        }

        return {
          receipt_uid: uid,
          verified: true,
          merchant_name: merchantName,
          store_address: storeAddress ?? merchantAddress,
          purchase_at: purchaseAt,
          total_price_eur:
            receipt.totalPrice != null ? Number(receipt.totalPrice) : null,
          vat_eur: vatEur,
          merits_preview: meritsPreview,
          hourly_wage_eur: rate.hourly_wage_eur,
          formula_version: rate.formula_version,
          wage_basis: rate.wage_basis,
          already_claimed: alreadyClaimed,
          ...(req.authUser
            ? {
                claim_allowed: claimAllowed,
                ...(claimBlock ? { claim_block: claimBlock } : {}),
              }
            : {}),
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
    },
  );

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
          message: "qr_or_uid is required",
        });
      }

      const location = parsed.data.location;
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

      // Rate limits (per scanner) — before FS to save calls when already capped.
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
          lat: location?.lat,
          lng: location?.lng,
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
      let storeKey: string | null;
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
        storeKey = normalizeStoreKey(
          formatFsAddress(receipt.unit),
          formatFsAddress(receipt.organization),
        );
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
          lat: location?.lat,
          lng: location?.lng,
        });
        return claimError(reply, 502, {
          claimed: false,
          receipt_uid: uid,
          code: "fs_error",
          message,
        });
      }

      let accountCreated: string | null = null;
      let accountCreatedMissing = true;
      try {
        const me = await ctx.rovas.fetchMe(user.accessToken);
        accountCreated = me.created;
        accountCreatedMissing = me.created == null;
      } catch (err) {
        req.log.warn({ err }, "Rovas /me for account created failed");
      }

      const fraudBlock = evaluateClaimFraud({
        settings,
        db: ctx.db,
        rovasUid: user.rovasUid,
        vatEur,
        purchaseAt,
        accountCreated,
        accountCreatedMissing,
        storeKey,
      });
      if (fraudBlock) {
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: outcomeFromBlock(fraudBlock.code),
          lat: location?.lat,
          lng: location?.lng,
          storeKey,
        });
        return claimError(reply, statusForBlock(fraudBlock), {
          claimed: false,
          receipt_uid: uid,
          code: fraudBlock.code,
          message: fraudBlock.message,
        });
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
          lat: location?.lat,
          lng: location?.lng,
          storeKey,
        });
        return claimError(reply, 422, {
          claimed: false,
          receipt_uid: uid,
          code: "rejected_shares",
          message:
            "Invalid shares: scanner must be included, uids distinct, percentages sum to 100.",
        });
      }

      const rate = await resolveMeritRate(ctx.rovas, settings);
      const totalMerits = computeMerits({
        vatEur,
        hourlyWageEur: rate.hourly_wage_eur,
        meritsPerHour: rate.merits_per_hour,
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
          hourly_wage_eur: rate.hourly_wage_eur,
          formula_version: rate.formula_version,
          shares: sharesInput.map((s) => ({
            rovas_uid: s.rovas_uid,
            share_pct: s.share_pct,
          })),
        });

        if (rovasResult.result !== 0) {
          const isDuplicate =
            rovasResult.result === 409 ||
            rovasResult.result_explain === "duplicate_receipt";
          if (isDuplicate) {
            recordAttempt(ctx, {
              receiptUid: uid,
              rovasUid: user.rovasUid,
              outcome: "duplicate",
              lat: location?.lat,
              lng: location?.lng,
              storeKey,
            });
            recordDuplicateStrike(ctx.db, user.rovasUid, settings);
            return claimError(reply, 409, {
              claimed: false,
              receipt_uid: uid,
              code: "duplicate",
              message: "This receipt has already been claimed on Rovas.",
            });
          }
          recordAttempt(ctx, {
            receiptUid: uid,
            rovasUid: user.rovasUid,
            outcome: "error",
            lat: location?.lat,
            lng: location?.lng,
            storeKey,
          });
          return claimError(reply, 502, {
            claimed: false,
            receipt_uid: uid,
            code: "rovas_error",
            message: rovasResult.result_explain || "Rovas rejected the claim.",
          });
        }

        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "claimed",
          lat: location?.lat,
          lng: location?.lng,
          storeKey,
        });

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
              lat: location?.lat,
              lng: location?.lng,
              storeKey,
            });
            recordDuplicateStrike(ctx.db, user.rovasUid, settings);
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
            lat: location?.lat,
            lng: location?.lng,
            storeKey,
          });
          return claimError(reply, err.status === 404 ? 502 : err.status, {
            claimed: false,
            receipt_uid: uid,
            code: "rovas_error",
            message: err.message,
          });
        }
        req.log.error({ err }, "claim failed");
        recordAttempt(ctx, {
          receiptUid: uid,
          rovasUid: user.rovasUid,
          outcome: "error",
          lat: location?.lat,
          lng: location?.lng,
          storeKey,
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
