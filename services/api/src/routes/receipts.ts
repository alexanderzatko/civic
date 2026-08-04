import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  computeMerits,
  parseReceiptUid,
  type VerifyReceiptResponse,
} from "@civic/shared";
import {
  EkasaClientError,
  extractMerchantName,
  extractVatEur,
  parseFsDate,
} from "../ekasa.js";
import type { AppContext } from "../context.js";

const bodySchema = z.object({
  qr_or_uid: z.string().min(1),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy_m: z.number().optional(),
    })
    .optional(),
});

export const receiptsRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  opts,
) => {
  const { ctx } = opts;

  app.post<{ Body: unknown }>("/receipts/verify", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
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
};
