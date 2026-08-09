/**
 * Finančná správa eKasa receipt/find client.
 * @see docs/ekasa-receipt-api.md
 */

export interface FsOrganization {
  name?: string;
  streetName?: string;
  municipality?: string;
  postalCode?: string;
  buildingNumber?: string | null;
  propertyRegistrationNumber?: string | null;
  country?: string;
  ico?: string;
  dic?: string;
  icDph?: string;
  [key: string]: unknown;
}

export interface FsUnit {
  name?: string | null;
  streetName?: string;
  municipality?: string;
  postalCode?: string;
  buildingNumber?: string | null;
  propertyRegistrationNumber?: string | null;
  country?: string;
  cashRegisterCode?: string;
  [key: string]: unknown;
}

export interface FsVatSummaryRow {
  vatBase?: number;
  vatAmount?: number;
  vat?: { vatRate?: number };
}

export interface FsReceiptItem {
  name?: string;
  itemType?: string;
  quantity?: number;
  vatRate?: number;
  price?: number;
  [key: string]: unknown;
}

export interface FsReceipt {
  receiptId?: string;
  issueDate?: string;
  createDate?: string;
  totalPrice?: number;
  vatAmountBasic?: number;
  vatAmountReduced?: number;
  vatRateBasic?: number;
  vatRateReduced?: number;
  taxBaseBasic?: number;
  taxBaseReduced?: number;
  freeTaxAmount?: number;
  customerId?: string | null;
  ico?: string;
  dic?: string;
  icDph?: string;
  receiptNumber?: number;
  organization?: FsOrganization;
  unit?: FsUnit;
  vatSummary?: FsVatSummaryRow[];
  items?: FsReceiptItem[];
  [key: string]: unknown;
}

export interface FsFindResponse {
  returnValue: number;
  receipt: FsReceipt | null;
  notification?: unknown;
  searchIdentification?: unknown;
}

export class EkasaClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "EkasaClientError";
  }
}

export class EkasaClient {
  constructor(private readonly findUrl: string) {}

  async findReceipt(receiptId: string): Promise<FsFindResponse> {
    const res = await fetch(this.findUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://opd.financnasprava.sk",
        Referer: "https://opd.financnasprava.sk/",
      },
      body: JSON.stringify({ receiptId }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new EkasaClientError(
        `FS receipt/find HTTP ${res.status}`,
        res.status,
        text.slice(0, 500),
      );
    }

    try {
      return JSON.parse(text) as FsFindResponse;
    } catch {
      throw new EkasaClientError("FS receipt/find returned non-JSON", res.status, text.slice(0, 500));
    }
  }
}

/** Prefer vatAmountBasic + vatAmountReduced; fall back to vatSummary sum. */
export function extractVatEur(receipt: FsReceipt): number {
  const basic = Number(receipt.vatAmountBasic ?? 0);
  const reduced = Number(receipt.vatAmountReduced ?? 0);
  const fromFields = basic + reduced;
  if (fromFields > 0 || (receipt.vatAmountBasic != null && receipt.vatAmountReduced != null)) {
    return roundMoney(fromFields);
  }

  if (Array.isArray(receipt.vatSummary)) {
    const sum = receipt.vatSummary.reduce(
      (acc, row) => acc + Number(row.vatAmount ?? 0),
      0,
    );
    return roundMoney(sum);
  }

  return 0;
}

export function extractMerchantName(receipt: FsReceipt): string | null {
  const name = receipt.organization?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Compose a single-line postal address from FS organization or unit fields. */
export function formatFsAddress(
  place: FsOrganization | FsUnit | undefined | null,
): string | null {
  if (!place) return null;
  const street = [place.streetName, place.propertyRegistrationNumber]
    .filter((p) => typeof p === "string" && p.trim())
    .join(" ");
  const city = [place.postalCode, place.municipality]
    .filter((p) => typeof p === "string" && p.trim())
    .join(" ");
  const parts = [street || null, city || null].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export type NormalizedReceiptDetail = {
  receipt_uid: string;
  merchant_name: string | null;
  merchant_address: string | null;
  store_name: string | null;
  store_address: string | null;
  purchase_at: string | null;
  purchase_at_display: string | null;
  total_price_eur: number | null;
  vat_eur: number;
  tax_base_basic_eur: number;
  tax_base_reduced_eur: number;
  vat_amount_basic_eur: number;
  vat_amount_reduced_eur: number;
  free_tax_eur: number;
  vat_rate_basic: number | null;
  vat_rate_reduced: number | null;
  ico: string | null;
  dic: string | null;
  ic_dph: string | null;
  receipt_number: number | null;
  items: Array<{
    name: string;
    quantity: number;
    price_eur: number;
    vat_rate: number;
    item_type: string | null;
  }>;
  vat_summary: Array<{
    vat_rate: number;
    vat_base_eur: number;
    vat_amount_eur: number;
  }>;
};

/** Map a successful FS receipt into the Civic detail DTO. */
export function normalizeReceiptDetail(
  receipt: FsReceipt,
  fallbackUid: string,
): NormalizedReceiptDetail {
  const uid =
    typeof receipt.receiptId === "string" && receipt.receiptId
      ? receipt.receiptId
      : fallbackUid;
  const issueRaw = receipt.issueDate ?? receipt.createDate ?? null;
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const vatSummary = Array.isArray(receipt.vatSummary)
    ? receipt.vatSummary
    : [];

  return {
    receipt_uid: uid,
    merchant_name: extractMerchantName(receipt),
    merchant_address: formatFsAddress(receipt.organization),
    store_name:
      typeof receipt.unit?.name === "string" && receipt.unit.name.trim()
        ? receipt.unit.name.trim()
        : null,
    store_address: formatFsAddress(receipt.unit),
    purchase_at: parseFsDate(issueRaw ?? undefined),
    purchase_at_display: issueRaw,
    total_price_eur:
      receipt.totalPrice != null ? Number(receipt.totalPrice) : null,
    vat_eur: extractVatEur(receipt),
    tax_base_basic_eur: Number(receipt.taxBaseBasic ?? 0),
    tax_base_reduced_eur: Number(receipt.taxBaseReduced ?? 0),
    vat_amount_basic_eur: Number(receipt.vatAmountBasic ?? 0),
    vat_amount_reduced_eur: Number(receipt.vatAmountReduced ?? 0),
    free_tax_eur: Number(receipt.freeTaxAmount ?? 0),
    vat_rate_basic:
      receipt.vatRateBasic != null ? Number(receipt.vatRateBasic) : null,
    vat_rate_reduced:
      receipt.vatRateReduced != null ? Number(receipt.vatRateReduced) : null,
    ico:
      typeof receipt.ico === "string"
        ? receipt.ico
        : typeof receipt.organization?.ico === "string"
          ? receipt.organization.ico
          : null,
    dic:
      typeof receipt.dic === "string"
        ? receipt.dic
        : typeof receipt.organization?.dic === "string"
          ? receipt.organization.dic
          : null,
    ic_dph:
      typeof receipt.icDph === "string"
        ? receipt.icDph
        : typeof receipt.organization?.icDph === "string"
          ? receipt.organization.icDph
          : null,
    receipt_number:
      receipt.receiptNumber != null ? Number(receipt.receiptNumber) : null,
    items: items.map((it) => ({
      name: typeof it.name === "string" ? it.name.trim() : "—",
      quantity: Number(it.quantity ?? 0),
      price_eur: Number(it.price ?? 0),
      vat_rate: Number(it.vatRate ?? 0),
      item_type: typeof it.itemType === "string" ? it.itemType : null,
    })),
    vat_summary: vatSummary.map((row) => ({
      vat_rate: Number(row.vat?.vatRate ?? 0),
      vat_base_eur: roundMoney(Number(row.vatBase ?? 0)),
      vat_amount_eur: roundMoney(Number(row.vatAmount ?? 0)),
    })),
  };
}

/**
 * FS dates look like "28.06.2022 11:37:35" (Europe/Bratislava wall time).
 * Return ISO-ish UTC string best-effort; null if unparseable.
 */
export function parseFsDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  // Interpret as local SK time offset +02:00 without DST awareness for MVP;
  // store as ISO with explicit offset so consumers can parse.
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+02:00`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
