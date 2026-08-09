import type {
  ContributionCategoryBreakdown,
  RankDistribution,
  ReceiptClaimsSummary,
  ReceiptHistoryView,
  ReceiptReceivedHistory,
  ReceiptReceivedItem,
  ReceiptSubmittedHistory,
  ReceiptSubmittedItem,
} from "@civic/shared";

export type RovasMe = {
  uid: number;
  username: string;
  display_name: string;
  total_me: number;
};

export type RovasAggregate = {
  total_me: number;
  by_category: ContributionCategoryBreakdown;
};

export type RovasMeritDistribution = {
  buckets: Array<{ label: string; count: number }>;
  user_bucket_index?: number;
  user_merits?: number;
  username?: string;
  total_users?: number;
  bin_edges_log10?: number[];
};

export class RovasClientError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 404 | 409 | 502 | 503 = 502,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "RovasClientError";
  }
}

/**
 * Thin HTTP client for Civic ↔ Rovas APIs
 * (`/rovas/me`, aggregates, merit distribution, VAT claim rule).
 */
export class RovasClient {
  private readonly base: string;

  constructor(rovasBaseUrl: string) {
    this.base = rovasBaseUrl.replace(/\/$/, "");
  }

  async fetchMe(accessToken: string): Promise<RovasMe> {
    const body = await this.getJson<Partial<RovasMe>>("/rovas/me", accessToken);
    if (
      typeof body.uid !== "number" ||
      typeof body.username !== "string" ||
      typeof body.total_me !== "number"
    ) {
      throw new RovasClientError("Rovas /me response missing required fields", 502);
    }
    return {
      uid: body.uid,
      username: body.username,
      display_name:
        typeof body.display_name === "string" && body.display_name
          ? body.display_name
          : body.username,
      total_me: body.total_me,
    };
  }

  async fetchAggregate(): Promise<RovasAggregate> {
    const body = await this.getJson<Partial<RovasAggregate>>(
      "/rovas/contributions/aggregate",
    );
    if (typeof body.total_me !== "number") {
      throw new RovasClientError(
        "Rovas contributions/aggregate missing total_me",
        502,
      );
    }
    return {
      total_me: body.total_me,
      by_category: normalizeCategories(body.by_category),
    };
  }

  async fetchMeritDistribution(
    accessToken?: string | null,
  ): Promise<RankDistribution> {
    const body = await this.getJson<RovasMeritDistribution>(
      "/rovas/merit_distribution",
      accessToken ?? undefined,
    );
    if (!Array.isArray(body.buckets)) {
      throw new RovasClientError(
        "Rovas merit_distribution missing buckets",
        502,
      );
    }
    const out: RankDistribution = {
      buckets: body.buckets.map((b) => ({
        label: String(b.label ?? ""),
        count: Number(b.count) || 0,
      })),
    };
    if (typeof body.user_bucket_index === "number") {
      out.user_bucket_index = body.user_bucket_index;
    }
    if (typeof body.user_merits === "number") {
      out.user_merits = body.user_merits;
    }
    if (typeof body.username === "string") {
      out.username = body.username;
    }
    if (typeof body.total_users === "number") {
      out.total_users = body.total_users;
    }
    if (Array.isArray(body.bin_edges_log10)) {
      out.bin_edges_log10 = body.bin_edges_log10.map(Number);
    }
    return out;
  }

  /**
   * Public national hourly rate (Rovas admin SoT).
   * Machine-name path (Services slash aliases are unreliable):
   * `GET /rovas/civic_national_hourly_rate?country=SK`
   */
  async fetchNationalHourlyRate(
    countryCode = "SK",
  ): Promise<RovasNationalHourlyRate> {
    const q = new URLSearchParams({ country: countryCode.toUpperCase() });
    const body = await this.getJson<Partial<RovasNationalHourlyRate>>(
      `/rovas/civic_national_hourly_rate?${q}`,
    );
    if (
      typeof body.hourly_wage_eur !== "number" ||
      !(body.hourly_wage_eur > 0)
    ) {
      throw new RovasClientError(
        "Rovas national_hourly_rate missing hourly_wage_eur",
        502,
        body,
      );
    }
    return {
      country_code:
        typeof body.country_code === "string" && body.country_code
          ? body.country_code.toUpperCase()
          : countryCode.toUpperCase(),
      hourly_wage_eur: body.hourly_wage_eur,
      merits_per_hour:
        typeof body.merits_per_hour === "number" && body.merits_per_hour > 0
          ? body.merits_per_hour
          : 10,
      source: typeof body.source === "string" ? body.source : "",
      updated:
        typeof body.updated === "string" || body.updated === null
          ? body.updated
          : null,
    };
  }

  /**
   * Split-claim typeahead. Machine-name path (Services slash aliases are
   * unreliable): `GET /rovas/users_search?query=`
   *
   * Rovas uses `query` (not `q`) because Drupal reserves $_GET['q'] for the
   * request path — `?q=ann` would 404 before Services runs.
   */
  async searchUsers(
    accessToken: string,
    q: string,
  ): Promise<RovasUserSearchResult[]> {
    const params = new URLSearchParams({ query: q });
    const body = await this.getJson<unknown>(
      `/rovas/users_search?${params}`,
      accessToken,
    );
    const rows = Array.isArray(body)
      ? body
      : Array.isArray((body as { results?: unknown })?.results)
        ? (body as { results: unknown[] }).results
        : null;
    if (!rows) {
      throw new RovasClientError(
        "Rovas users_search response must be an array",
        502,
        body,
      );
    }
    return rows.slice(0, 10).map((raw) => {
      const r = raw as Partial<RovasUserSearchResult>;
      const uid = r.rovas_uid != null ? String(r.rovas_uid) : "";
      const username = typeof r.username === "string" ? r.username : "";
      if (!uid || !username) {
        throw new RovasClientError(
          "Rovas users_search row missing rovas_uid/username",
          502,
          body,
        );
      }
      return {
        rovas_uid: uid,
        username,
        display_name:
          typeof r.display_name === "string" && r.display_name
            ? r.display_name
            : username,
      };
    });
  }

  /**
   * Global receipt UID claim check for verify preview.
   * `GET /rovas/civic_claims?receipt_uid=`
   */
  async fetchClaimStatus(
    accessToken: string,
    receiptUid: string,
  ): Promise<{ claimed: boolean; receipt_uid: string }> {
    const params = new URLSearchParams({ receipt_uid: receiptUid });
    const body = await this.getJson<Partial<{ claimed: boolean; receipt_uid: string }>>(
      `/rovas/civic_claims?${params}`,
      accessToken,
    );
    return {
      claimed: Boolean(body.claimed),
      receipt_uid:
        typeof body.receipt_uid === "string" && body.receipt_uid
          ? body.receipt_uid
          : receiptUid,
    };
  }

  /**
   * Paginated claim history.
   * `GET /rovas/civic_claims?view=submitted|received&limit=&offset=`
   */
  async fetchClaims(
    accessToken: string,
    view: ReceiptHistoryView,
    opts?: { limit?: number; offset?: number },
  ): Promise<ReceiptSubmittedHistory | ReceiptReceivedHistory> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const params = new URLSearchParams({
      view,
      limit: String(limit),
      offset: String(offset),
    });
    const body = await this.getJson<Partial<ReceiptSubmittedHistory | ReceiptReceivedHistory>>(
      `/rovas/civic_claims?${params}`,
      accessToken,
    );
    if (!Array.isArray(body.items) || typeof body.total !== "number") {
      throw new RovasClientError(
        "Rovas civic_claims list missing items/total",
        502,
        body,
      );
    }
    if (view === "submitted") {
      return {
        view: "submitted",
        total: body.total,
        limit: typeof body.limit === "number" ? body.limit : limit,
        offset: typeof body.offset === "number" ? body.offset : offset,
        items: (body.items as ReceiptSubmittedItem[]).map((raw) => ({
          receipt_uid: String(raw.receipt_uid ?? ""),
          vat_eur: Number(raw.vat_eur) || 0,
          total_merits_awarded: Number(raw.total_merits_awarded) || 0,
          merchant_name:
            typeof raw.merchant_name === "string" ? raw.merchant_name : null,
          purchase_at:
            typeof raw.purchase_at === "string" ? raw.purchase_at : null,
          created_at:
            typeof raw.created_at === "string" ? raw.created_at : "",
          shares: Array.isArray(raw.shares)
            ? raw.shares.map((s) => ({
                beneficiary_rovas_uid: String(s.beneficiary_rovas_uid ?? ""),
                share_pct: Number(s.share_pct) || 0,
                merits_awarded: Number(s.merits_awarded) || 0,
              }))
            : [],
        })),
      };
    }
    return {
      view: "received",
      total: body.total,
      limit: typeof body.limit === "number" ? body.limit : limit,
      offset: typeof body.offset === "number" ? body.offset : offset,
      items: (body.items as ReceiptReceivedItem[]).map((raw) => ({
        receipt_uid: String(raw.receipt_uid ?? ""),
        merchant_name:
          typeof raw.merchant_name === "string" ? raw.merchant_name : null,
        purchase_at:
          typeof raw.purchase_at === "string" ? raw.purchase_at : null,
        scanner_rovas_uid: String(raw.scanner_rovas_uid ?? ""),
        scanner_username:
          typeof raw.scanner_username === "string" && raw.scanner_username
            ? raw.scanner_username
            : undefined,
        scanner_display_name:
          typeof raw.scanner_display_name === "string" &&
          raw.scanner_display_name
            ? raw.scanner_display_name
            : undefined,
        share_pct: Number(raw.share_pct) || 0,
        merits_awarded: Number(raw.merits_awarded) || 0,
        created_at: typeof raw.created_at === "string" ? raw.created_at : "",
      })),
    };
  }

  /** Received-based taxes summary: `GET /rovas/civic_claims/summary`. */
  async fetchClaimsSummary(
    accessToken: string,
  ): Promise<ReceiptClaimsSummary> {
    const body = await this.getJson<Partial<ReceiptClaimsSummary>>(
      "/rovas/civic_claims/summary",
      accessToken,
    );
    return {
      receipt_count: Number(body.receipt_count) || 0,
      total_vat_eur: Number(body.total_vat_eur) || 0,
      taxes_me: Number(body.taxes_me) || 0,
    };
  }

  async claimVatReceipt(
    accessToken: string,
    payload: RovasClaimVatReceiptRequest,
  ): Promise<RovasClaimVatReceiptResponse> {
    const body = await this.postJson<Partial<RovasClaimVatReceiptResponse>>(
      "/rovas/rules/rules_proxy_claim_vat_receipt",
      accessToken,
      payload,
    );
    if (
      typeof body.total_merits_awarded !== "number" ||
      !Array.isArray(body.shares)
    ) {
      throw new RovasClientError(
        "Rovas claim response missing required fields",
        502,
        body,
      );
    }
    return {
      total_merits_awarded: body.total_merits_awarded,
      shares: body.shares.map((s) => ({
        beneficiary_rovas_uid: String(s.beneficiary_rovas_uid),
        merits_awarded: Number(s.merits_awarded) || 0,
      })),
      result: typeof body.result === "number" ? body.result : 0,
      result_explain:
        typeof body.result_explain === "string" ? body.result_explain : "ok",
    };
  }

  private async getJson<T>(
    path: string,
    accessToken?: string,
  ): Promise<T> {
    return this.requestJson<T>(path, { method: "GET", accessToken });
  }

  private async postJson<T>(
    path: string,
    accessToken: string,
    payload: unknown,
  ): Promise<T> {
    return this.requestJson<T>(path, {
      method: "POST",
      accessToken,
      body: JSON.stringify(payload),
    });
  }

  private async requestJson<T>(
    path: string,
    opts: {
      method: "GET" | "POST";
      accessToken?: string;
      body?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.accessToken) {
      headers.Authorization = `Bearer ${opts.accessToken}`;
    }
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method: opts.method,
        headers,
        body: opts.body,
      });
    } catch {
      throw new RovasClientError(`Rovas unreachable (${path})`, 503);
    }

    let parsed: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (res.status === 401) {
      throw new RovasClientError(`Rovas unauthorized (${path})`, 401, parsed);
    }
    if (res.status === 404) {
      throw new RovasClientError(`Rovas not found (${path})`, 404, parsed);
    }
    if (res.status === 409) {
      throw new RovasClientError(`Rovas conflict (${path})`, 409, parsed);
    }
    if (!res.ok) {
      throw new RovasClientError(
        `Rovas ${path} failed (${res.status})`,
        res.status >= 500 ? 503 : 502,
        parsed,
      );
    }

    return parsed as T;
  }
}

export type RovasUserSearchResult = {
  rovas_uid: string;
  username: string;
  display_name: string;
};

export type RovasNationalHourlyRate = {
  country_code: string;
  hourly_wage_eur: number;
  merits_per_hour: number;
  source: string;
  updated: string | null;
};

export type RovasClaimVatReceiptRequest = {
  receipt_uid: string;
  vat_eur: number;
  total_merits: number;
  merchant_name: string | null;
  purchase_at: string | null;
  hourly_wage_eur: number;
  formula_version: number;
  shares: Array<{ rovas_uid: string; share_pct: number }>;
};

export type RovasClaimVatReceiptResponse = {
  total_merits_awarded: number;
  shares: Array<{ beneficiary_rovas_uid: string; merits_awarded: number }>;
  result: number;
  result_explain: string;
};

function normalizeCategories(
  raw: Partial<ContributionCategoryBreakdown> | undefined,
): ContributionCategoryBreakdown {
  return {
    taxes: Number(raw?.taxes) || 0,
    charity: Number(raw?.charity) || 0,
    volunteer: Number(raw?.volunteer) || 0,
  };
}
