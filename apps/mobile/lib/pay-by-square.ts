import { CurrencyCode, encode, PaymentOptions } from "bysquare/pay";

/**
 * When NeoFund’s remittance IBAN is ready, set this compact IBAN to route
 * gift transfers there instead of the organisation’s verified account.
 * Until then, callers pass the org `donate_iban` from project detail.
 */
export const GIFT_BENEFICIARY_IBAN_OVERRIDE: string | null = null;

export type GiftPaymentInput = {
  /** Compact SEPA IBAN (org donate_iban, unless override is set). */
  iban: string;
  amountEur: number;
  beneficiaryName: string;
};

/** Resolve which IBAN to encode (NeoFund override wins when configured). */
export function resolveGiftBeneficiaryIban(orgIban: string): string {
  const override = GIFT_BENEFICIARY_IBAN_OVERRIDE?.replace(/\s+/g, "").toUpperCase();
  if (override) return override;
  return orgIban.replace(/\s+/g, "").toUpperCase();
}

/**
 * Banks are happier with ASCII beneficiary names (Base32hex / alphanumeric QR).
 * Strip combining marks after NFD; keep letters/digits/spaces/basic punctuation.
 */
export function asciiBeneficiaryName(raw: string): string {
  const stripped = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 70) || "Organisation";
}

/**
 * Encode a PAY by square payment-order payload for Slovak banking apps.
 * Returns the Base32Hex string to place in a QR code.
 */
export function encodeGiftPayBySquare(input: GiftPaymentInput): string {
  const iban = resolveGiftBeneficiaryIban(input.iban);
  const amount = Math.round(input.amountEur * 100) / 100;
  const name = asciiBeneficiaryName(input.beneficiaryName);
  // Default bysquare encode uses spec v1.2.0 (header nibble 2 → payload
  // starts with "08…"). Many SK bank apps still only accept v1.1.0 ("04…")
  // and report "unsupported QR code type" for 1.2.0. Pin to 1.1.0.
  return encode(
    {
      payments: [
        {
          type: PaymentOptions.PaymentOrder,
          amount,
          currencyCode: CurrencyCode.EUR,
          beneficiary: { name },
          bankAccounts: [{ iban }],
        },
      ],
    },
    { version: 1, deburr: true, validate: true },
  );
}

/** Plain-text block for manual entry / share when QR handoff fails. */
export function formatGiftPaymentDetails(input: {
  iban: string;
  amountEur: number;
  beneficiaryName: string;
}): string {
  const iban = resolveGiftBeneficiaryIban(input.iban);
  const amount = formatGiftAmountEur(input.amountEur);
  const name = input.beneficiaryName.trim() || "Organisation";
  return [
    name,
    `IBAN: ${iban}`,
    `Amount: ${amount} EUR`,
  ].join("\n");
}

/** Parse a user-entered EUR amount (`.` or `,` decimals). */
export function parseGiftAmountEur(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!(n > 0) || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function formatGiftAmountEur(amount: number): string {
  return amount.toLocaleString("sk-SK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
