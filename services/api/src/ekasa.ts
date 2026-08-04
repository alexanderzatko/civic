/**
 * Finančná správa eKasa receipt/find client.
 * @see docs/ekasa-receipt-api.md
 */

export interface FsOrganization {
  name?: string;
  streetName?: string;
  municipality?: string;
  postalCode?: string;
  [key: string]: unknown;
}

export interface FsVatSummaryRow {
  vatBase?: number;
  vatAmount?: number;
  vat?: { vatRate?: number };
}

export interface FsReceipt {
  receiptId?: string;
  issueDate?: string;
  createDate?: string;
  totalPrice?: number;
  vatAmountBasic?: number;
  vatAmountReduced?: number;
  customerId?: string | null;
  organization?: FsOrganization;
  vatSummary?: FsVatSummaryRow[];
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
