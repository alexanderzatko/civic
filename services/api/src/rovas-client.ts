import type {
  ContributionCategoryBreakdown,
  ProjectDetail,
  ProjectShareholderItem,
  ProjectShareholderPage,
  ProjectWorkReportItem,
  ProjectWorkReportPage,
  RankDistribution,
  ReceiptClaimsSummary,
  ReceiptHistoryView,
  ReceiptReceivedHistory,
  ReceiptReceivedItem,
  ReceiptSubmittedHistory,
  ReceiptSubmittedItem,
  UserLookup,
  UserLookupProjectRow,
  UserLookupTaxMonth,
} from "@civic/shared";
import {
  appendLangParam,
  type CivicContentLang,
} from "./content-lang.js";

export type RovasMe = {
  uid: number;
  username: string;
  display_name: string;
  total_me: number;
  /** ISO-8601 account registration time from Drupal `$user->created`. */
  created: string | null;
  /**
   * Preferred interface language from Drupal `$account->language`
   * (e.g. `sk`, `en`, `cs`). Optional until Rovas exposes it on `/rovas/me`.
   */
  language: string | null;
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
    readonly status: 400 | 401 | 404 | 409 | 502 | 503 = 502,
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
    const body = await this.getJson<
      Partial<RovasMe> & { created?: unknown; language?: unknown }
    >("/rovas/me", accessToken);
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
      created: typeof body.created === "string" && body.created ? body.created : null,
      language: typeof body.language === "string" && body.language ? body.language : null,
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
   * Community public profile by exact username.
   * `GET /rovas/users_lookup?username=&lang=`
   */
  async lookupUser(
    accessToken: string,
    username: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<UserLookup> {
    const params = new URLSearchParams({ username });
    appendLangParam(params, opts?.lang);
    const body = await this.getJson<Partial<UserLookup>>(
      `/rovas/users_lookup?${params}`,
      accessToken,
    );
    const uid = body.rovas_uid != null ? String(body.rovas_uid) : "";
    const name = typeof body.username === "string" ? body.username : "";
    if (!uid || !name || typeof body.total_me !== "number") {
      throw new RovasClientError(
        "Rovas users_lookup missing rovas_uid/username/total_me",
        502,
        body,
      );
    }
    return {
      rovas_uid: uid,
      username: name,
      display_name:
        typeof body.display_name === "string" && body.display_name
          ? body.display_name
          : name,
      total_me: body.total_me,
      by_category: normalizeCategories(body.by_category),
      taxes_last_3_months: normalizeTaxMonths(body.taxes_last_3_months),
      top_charities: normalizeProjectRows(body.top_charities),
      top_volunteer_projects: normalizeProjectRows(body.top_volunteer_projects),
    };
  }

  /**
   * Project detail for Civic modal.
   * `GET /rovas/civic_project/{nid}?lang=`
   */
  async fetchProject(
    accessToken: string,
    projectNid: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<ProjectDetail> {
    const nid = encodeURIComponent(projectNid);
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<Partial<ProjectDetail>>(
      `/rovas/civic_project/${nid}${qs ? `?${qs}` : ""}`,
      accessToken,
    );
    return normalizeProjectDetail(body, projectNid);
  }

  /**
   * Paginated work reports for a project.
   * `GET /rovas/civic_project_work_reports?project_nid=&lang=`
   */
  async fetchProjectWorkReports(
    accessToken: string,
    projectNid: string,
    opts?: { limit?: number; offset?: number; lang?: CivicContentLang },
  ): Promise<ProjectWorkReportPage> {
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const params = new URLSearchParams({
      project_nid: projectNid,
      limit: String(limit),
      offset: String(offset),
    });
    appendLangParam(params, opts?.lang);
    const body = await this.getJson<Partial<ProjectWorkReportPage>>(
      `/rovas/civic_project_work_reports?${params}`,
      accessToken,
    );
    return normalizeWorkReportPage(body, projectNid, limit, offset);
  }

  /**
   * Paginated project shareholders.
   * `GET /rovas/civic_project_shareholders?project_nid=`
   */
  async fetchProjectShareholders(
    accessToken: string,
    projectNid: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<ProjectShareholderPage> {
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const params = new URLSearchParams({
      project_nid: projectNid,
      limit: String(limit),
      offset: String(offset),
    });
    const body = await this.getJson<Partial<ProjectShareholderPage>>(
      `/rovas/civic_project_shareholders?${params}`,
      accessToken,
    );
    return normalizeShareholderPage(body, projectNid, limit, offset);
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
    if (res.status === 400) {
      throw new RovasClientError(`Rovas bad request (${path})`, 400, parsed);
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

function normalizeTaxMonths(raw: unknown): UserLookupTaxMonth[] {
  if (!Array.isArray(raw)) return [];
  const out: UserLookupTaxMonth[] = [];
  for (const row of raw.slice(0, 3)) {
    const r = row as Partial<UserLookupTaxMonth>;
    const month = typeof r.month === "string" ? r.month : "";
    const me = Number(r.me);
    if (!month || !Number.isFinite(me)) continue;
    out.push({ month, me });
  }
  return out;
}

function normalizeProjectRows(raw: unknown): UserLookupProjectRow[] {
  if (!Array.isArray(raw)) return [];
  const out: UserLookupProjectRow[] = [];
  for (const row of raw.slice(0, 3)) {
    const r = row as Partial<UserLookupProjectRow>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const me = Number(r.me);
    if (!name || !Number.isFinite(me)) continue;
    const projectNid =
      r.project_nid != null && String(r.project_nid).trim()
        ? String(r.project_nid).trim()
        : undefined;
    out.push(projectNid ? { project_nid: projectNid, name, me } : { name, me });
  }
  return out;
}

function normalizeWorkReportItem(raw: unknown): ProjectWorkReportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ProjectWorkReportItem> & { photo_urls?: unknown };
  const workReportNid =
    r.work_report_nid != null ? String(r.work_report_nid).trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!workReportNid || !title) return null;
  const hoursRaw = r.hours;
  const hours =
    hoursRaw == null || hoursRaw === ("" as unknown)
      ? null
      : Number.isFinite(Number(hoursRaw))
        ? Number(hoursRaw)
        : null;
  const photoUrls = Array.isArray(r.photo_urls)
    ? r.photo_urls
        .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
        .map((u) => u.trim())
    : [];
  return {
    work_report_nid: workReportNid,
    title,
    summary: typeof r.summary === "string" && r.summary ? r.summary : null,
    hours,
    author_username:
      typeof r.author_username === "string" && r.author_username
        ? r.author_username
        : null,
    author_display_name:
      typeof r.author_display_name === "string" && r.author_display_name
        ? r.author_display_name
        : null,
    created_at:
      typeof r.created_at === "string" && r.created_at ? r.created_at : null,
    photo_urls: photoUrls,
  };
}

function normalizeWorkReportPage(
  raw: Partial<ProjectWorkReportPage> | undefined,
  fallbackNid: string,
  fallbackLimit: number,
  fallbackOffset: number,
): ProjectWorkReportPage {
  const items = Array.isArray(raw?.items)
    ? raw.items
        .map(normalizeWorkReportItem)
        .filter((x): x is ProjectWorkReportItem => x != null)
    : [];
  return {
    project_nid:
      raw?.project_nid != null && String(raw.project_nid).trim()
        ? String(raw.project_nid).trim()
        : fallbackNid,
    total: typeof raw?.total === "number" ? raw.total : items.length,
    limit: typeof raw?.limit === "number" ? raw.limit : fallbackLimit,
    offset: typeof raw?.offset === "number" ? raw.offset : fallbackOffset,
    items,
  };
}

function normalizeShareholderItem(raw: unknown): ProjectShareholderItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ProjectShareholderItem>;
  const username = typeof r.username === "string" ? r.username.trim() : "";
  if (!username) return null;
  const kind =
    r.share_kind === "percent" || r.share_kind === "time_based"
      ? r.share_kind
      : Number(r.share_percent) > 0
        ? "percent"
        : "time_based";
  const sharePercent =
    kind === "percent" && Number.isFinite(Number(r.share_percent))
      ? Number(r.share_percent)
      : null;
  const hours =
    r.hours == null || r.hours === ("" as unknown)
      ? null
      : Number.isFinite(Number(r.hours))
        ? Number(r.hours)
        : null;
  return {
    username,
    share_kind: kind,
    share_percent: sharePercent,
    hours,
  };
}

function normalizeShareholderPage(
  raw: Partial<ProjectShareholderPage> | undefined,
  fallbackNid: string,
  fallbackLimit: number,
  fallbackOffset: number,
): ProjectShareholderPage {
  const items = Array.isArray(raw?.items)
    ? raw.items
        .map(normalizeShareholderItem)
        .filter((x): x is ProjectShareholderItem => x != null)
    : [];
  return {
    project_nid:
      raw?.project_nid != null && String(raw.project_nid).trim()
        ? String(raw.project_nid).trim()
        : fallbackNid,
    total: typeof raw?.total === "number" ? raw.total : items.length,
    limit: typeof raw?.limit === "number" ? raw.limit : fallbackLimit,
    offset: typeof raw?.offset === "number" ? raw.offset : fallbackOffset,
    items,
  };
}

function emptyShareholderPage(projectNid: string): ProjectShareholderPage {
  return {
    project_nid: projectNid,
    total: 0,
    limit: 20,
    offset: 0,
    items: [],
  };
}

function normalizeProjectDetail(
  raw: Partial<ProjectDetail>,
  fallbackNid: string,
): ProjectDetail {
  const projectNid =
    raw.project_nid != null && String(raw.project_nid).trim()
      ? String(raw.project_nid).trim()
      : fallbackNid;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    throw new RovasClientError(
      "Rovas civic_project missing title",
      502,
      raw,
    );
  }
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const wr = normalizeWorkReportPage(raw.work_reports, projectNid, 20, 0);
  const shareholders = raw.shareholders
    ? normalizeShareholderPage(raw.shareholders, projectNid, 20, 0)
    : emptyShareholderPage(projectNid);
  return {
    project_nid: projectNid,
    title,
    summary: typeof raw.summary === "string" && raw.summary ? raw.summary : null,
    is_public: Boolean(raw.is_public),
    owner_username:
      typeof raw.owner_username === "string" && raw.owner_username
        ? raw.owner_username
        : null,
    owner_display_name:
      typeof raw.owner_display_name === "string" && raw.owner_display_name
        ? raw.owner_display_name
        : null,
    total_hours: numOrNull(raw.total_hours),
    total_me: numOrNull(raw.total_me),
    work_report_count:
      typeof raw.work_report_count === "number"
        ? raw.work_report_count
        : wr.total,
    shareholder_count:
      typeof raw.shareholder_count === "number"
        ? raw.shareholder_count
        : shareholders.total,
    rovas_url:
      typeof raw.rovas_url === "string" && raw.rovas_url
        ? raw.rovas_url
        : "",
    work_reports: wr,
    shareholders,
  };
}
