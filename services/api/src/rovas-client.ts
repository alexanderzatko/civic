import type {
  ContributionCategoryBreakdown,
  MeSourcesDetail,
  MeSourcesShare,
  MeritHistoryItem,
  MeritHistoryPage,
  MeritHistorySourceKind,
  MeritIndexCountry,
  MeritIndexFilters,
  MeritIndexPage,
  MeritIndexRow,
  MeritIndexSort,
  MeritIndexOrder,
  MeritSourceBreakdown,
  MeritSourceCategory,
  MeritSpotlight,
  MeritSpotlightFilters,
  MeritSpotlightLead,
  MeritSpotlightPeriod,
  MeritSpotlightYou,
  ProjectDetail,
  ProjectShareholderItem,
  ProjectShareholderPage,
  ProjectWorkReportPage,
  RankDistribution,
  ReceiptClaimsSummary,
  ReceiptHistoryFilters,
  ReceiptHistoryView,
  ReceiptReceivedHistory,
  ReceiptReceivedItem,
  ReceiptSubmittedHistory,
  ReceiptSubmittedItem,
  UserLookup,
  UserLookupProjectRow,
  UserLookupTaxMonth,
  NaceExpertiseSection,
  VolunteerProjectRow,
  NaceNode,
  ClassifyNaceResponse,
  AiNaceStatus,
  CreateCharityOrgBody,
  CreateCharityOrgSuccess,
  CreateProjectBody,
  CreateWorkReportBody,
  CreateWorkReportErrorCode,
  RewardKind,
  WorkReportMapConfig,
  CharityProject,
  CharityProjectsResponse,
} from "@civic/shared";
import {
  compactIbanOrNull,
  displayMerits,
  capProjectRowsToCategory,
  resolveContributionCategories,
} from "@civic/shared";
import {
  appendLangParam,
  type CivicContentLang,
} from "./content-lang.js";
import {
  normalizeWorkReportDetail,
  normalizeWorkReportPage,
} from "./work-report-normalize.js";

export type RovasReceiptHistoryRetention = "keep" | "policy";

export type RovasMe = {
  uid: number;
  username: string;
  display_name: string;
  total_me: number;
  /** Chron wallet from `field_chrons_balance` when exposed on `/rovas/me`. */
  total_chr?: number;
  /** ISO-8601 account registration time from Drupal `$user->created`. */
  created: string | null;
  /**
   * Preferred interface language from Drupal `$account->language`
   * (e.g. `sk`, `en`, `cs`). Optional until Rovas exposes it on `/rovas/me`.
   */
  language: string | null;
  /**
   * Receipt scanning-history retention. `null` until answered.
   * See Rovas task `receipt-history-retention`.
   */
  receipt_history_retention: RovasReceiptHistoryRetention | null;
  /**
   * Who may see Taxes vs Gifts detail. Defaults to `everyone`.
   * See Rovas task `me-sources-privacy`.
   */
  me_sources_share: MeSourcesShare;
  /**
   * Sticky Trusted user flag. See Rovas task `trusted-user-notify`.
   */
  trusted_user: boolean;
  /**
   * `0` default/revoked, `1` show banner, `2` permanently dismissed.
   */
  trusted_notify: 0 | 1 | 2;
};

export type RovasDismissTrustedNotifyResult = {
  trusted_user: boolean;
  trusted_notify: 0 | 1 | 2;
};

export type RovasReceiptHistoryPreferenceResult = {
  receipt_history_retention: RovasReceiptHistoryRetention;
  scrubbed_claims: number;
};

export type RovasMeSourcesPreferenceResult = {
  me_sources_share: MeSourcesShare;
};

/** Response from Rovas `POST /rovas/civic_give_chrons` (1 CHR = 1 ME). */
export type RovasGiveChronsResult = {
  chrons_given: number;
  merits_gained: number;
  total_chr: number;
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
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 502 | 503 = 502,
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
      Partial<RovasMe> & {
        created?: unknown;
        language?: unknown;
        receipt_history_retention?: unknown;
        me_sources_share?: unknown;
        trusted_user?: unknown;
        trusted_notify?: unknown;
      }
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
      total_chr:
        typeof body.total_chr === "number" && Number.isFinite(body.total_chr)
          ? body.total_chr
          : undefined,
      created: typeof body.created === "string" && body.created ? body.created : null,
      language: typeof body.language === "string" && body.language ? body.language : null,
      receipt_history_retention: parseReceiptHistoryRetention(
        body.receipt_history_retention,
      ),
      me_sources_share: parseMeSourcesShare(body.me_sources_share),
      trusted_user: body.trusted_user === true,
      trusted_notify: parseTrustedNotify(body.trusted_notify),
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
      member_since_year: (() => {
        const raw = (body as { member_since_year?: unknown }).member_since_year;
        const y = Number(raw);
        return Number.isFinite(y) && y > 0 ? y : 0;
      })(),
      ...(() => {
        const detail = parseMeSourcesDetail(
          (body as { me_sources_detail?: unknown }).me_sources_detail,
        );
        const by = normalizeCategories(
          body.by_category,
          (body as { by_source?: unknown }).by_source,
          detail,
        );
        // Cap project tables to post-penalty category ME (Rovas keeps gross).
        // Aggregate: tax/gift drill-downs are empty; volunteer still capped.
        return {
          by_category: by,
          me_sources_detail: detail,
          top_charities:
            detail === "aggregate"
              ? []
              : capProjectRowsToCategory(
                  normalizeProjectRows(body.top_charities),
                  by.charity,
                ),
          top_volunteer_projects: capProjectRowsToCategory(
            normalizeProjectRows(body.top_volunteer_projects),
            by.volunteer,
          ),
          taxes_last_3_months:
            detail === "aggregate"
              ? []
              : normalizeTaxMonths(body.taxes_last_3_months),
        };
      })(),
      nace_expertise: normalizeNaceExpertise(body.nace_expertise),
    };
  }

  /**
   * Signed-in Merit ledger (Views merit_history / page_1).
   * `GET /rovas/civic_merit_history?limit=&offset=&lang=`
   */
  async fetchMeritHistory(
    accessToken: string,
    opts?: { limit?: number; offset?: number; lang?: CivicContentLang },
  ): Promise<MeritHistoryPage> {
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    appendLangParam(params, opts?.lang);
    const body = await this.getJson<Partial<MeritHistoryPage>>(
      `/rovas/civic_merit_history?${params}`,
      accessToken,
    );
    return normalizeMeritHistoryPage(body, limit, offset);
  }

  /**
   * Merit Index leaderboard for Civic Prínos / ME•ter tab.
   * Lifetime: `GET /rovas/civic_merit_index?…`
   * Period: `GET /rovas/civic_merit_period_index?period=…` when `filters.period` set.
   */
  async fetchMeritIndex(
    accessToken?: string | null,
    filters: MeritIndexFilters = {},
  ): Promise<MeritIndexPage> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const period =
      filters.period === "day" ||
      filters.period === "week" ||
      filters.period === "month"
        ? filters.period
        : undefined;

    if (period) {
      return this.fetchMeritPeriodIndex(accessToken, {
        ...filters,
        period,
        limit,
        offset,
      });
    }

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.order) params.set("order", filters.order);
    if (filters.country_iso2?.trim()) {
      params.set("country_iso2", filters.country_iso2.trim().toUpperCase());
    }
    if (filters.since_from?.trim()) {
      params.set("since_from", filters.since_from.trim());
    }
    if (filters.min_me != null && Number.isFinite(filters.min_me)) {
      params.set("min_me", String(filters.min_me));
    }
    if (filters.max_me != null && Number.isFinite(filters.max_me)) {
      params.set("max_me", String(filters.max_me));
    }
    if (filters.min_value_eur != null && Number.isFinite(filters.min_value_eur)) {
      params.set("min_value_eur", String(filters.min_value_eur));
    }
    if (filters.max_value_eur != null && Number.isFinite(filters.max_value_eur)) {
      params.set("max_value_eur", String(filters.max_value_eur));
    }
    if (filters.nace_section_tid != null && filters.nace_section_tid > 0) {
      params.set("nace_section_tid", String(filters.nace_section_tid));
    }
    if (filters.source_category) {
      params.set("source_category", filters.source_category);
    }
    appendLangParam(params, filters.lang as CivicContentLang | undefined);
    const body = await this.getJson<Partial<MeritIndexPage>>(
      `/rovas/civic_merit_index?${params}`,
      accessToken ?? undefined,
    );
    return normalizeMeritIndexPage(body, limit, offset);
  }

  /**
   * Period Merit leaderboard (ME earned in window).
   * `GET /rovas/civic_merit_period_index?period=&…`
   * Empty page on 404 until Rovas ships the resource.
   */
  async fetchMeritPeriodIndex(
    accessToken: string | null | undefined,
    filters: MeritIndexFilters & { period: MeritSpotlightPeriod },
  ): Promise<MeritIndexPage> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const params = new URLSearchParams({
      period: filters.period,
      limit: String(limit),
      offset: String(offset),
    });
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.order) params.set("order", filters.order);
    if (filters.country_iso2?.trim()) {
      params.set("country_iso2", filters.country_iso2.trim().toUpperCase());
    }
    if (filters.source_category) {
      params.set("source_category", filters.source_category);
    }
    appendLangParam(params, filters.lang as CivicContentLang | undefined);
    try {
      const body = await this.getJson<Partial<MeritIndexPage>>(
        `/rovas/civic_merit_period_index?${params}`,
        accessToken ?? undefined,
      );
      return normalizeMeritIndexPage(body, limit, offset, filters.period);
    } catch (err) {
      if (err instanceof RovasClientError && err.status === 404) {
        return emptyMeritIndexPage(limit, offset, filters.period);
      }
      throw err;
    }
  }

  /**
   * Distinct countries on the Merit Index (users with total_me > 0).
   * `GET /rovas/civic_merit_index_countries?lang=`
   */
  async fetchMeritIndexCountries(
    accessToken?: string | null,
    opts?: { lang?: CivicContentLang },
  ): Promise<MeritIndexCountry[]> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<{ countries?: unknown }>(
      `/rovas/civic_merit_index_countries${qs ? `?${qs}` : ""}`,
      accessToken ?? undefined,
    );
    return normalizeMeritIndexCountries(body?.countries);
  }

  /**
   * Period Merit spotlight (top earners by area in a time window).
   * `GET /rovas/civic_merit_spotlight?period=&country_iso2=&lang=`
   * Returns an empty payload on 404 so Civic UI can hide until Rovas ships.
   */
  async fetchMeritSpotlight(
    accessToken: string | null | undefined,
    filters: MeritSpotlightFilters,
  ): Promise<MeritSpotlight> {
    const period = normalizeSpotlightPeriod(filters.period);
    const country = filters.country_iso2?.trim().toUpperCase() || null;
    const params = new URLSearchParams({ period });
    if (country) params.set("country_iso2", country);
    appendLangParam(params, filters.lang as CivicContentLang | undefined);
    try {
      const body = await this.getJson<Partial<MeritSpotlight>>(
        `/rovas/civic_merit_spotlight?${params}`,
        accessToken ?? undefined,
      );
      return normalizeMeritSpotlight(body, period, country);
    } catch (err) {
      if (err instanceof RovasClientError && err.status === 404) {
        return emptyMeritSpotlight(period, country);
      }
      throw err;
    }
  }

  /**
   * Approved public-benefit / nonprofit projects catalog (Gifts path; public / anonymous).
   * Wire: `GET /rovas/civic_charity_projects?lang=&query=&limit=`
   */
  async fetchCharityProjects(opts?: {
    lang?: CivicContentLang;
    query?: string;
    limit?: number;
  }): Promise<CharityProjectsResponse> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const q = opts?.query?.trim();
    if (q) params.set("query", q);
    if (opts?.limit != null && Number.isFinite(opts.limit)) {
      params.set("limit", String(Math.min(Math.max(Math.trunc(opts.limit), 1), 20)));
    }
    const qs = params.toString();
    const body = await this.getJson<{
      total?: unknown;
      projects?: unknown;
    }>(`/rovas/civic_charity_projects${qs ? `?${qs}` : ""}`);
    return normalizeCharityProjectsResponse(body);
  }

  /**
   * Project detail for Civic modal.
   * `GET /rovas/civic_project/{nid}?lang=`
   * Bearer optional — anonymous allowed for approved public-benefit / nonprofit projects (`is_charity` + approved org).
   */
  async fetchProject(
    accessToken: string | null | undefined,
    projectNid: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<ProjectDetail> {
    const nid = encodeURIComponent(projectNid);
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<Partial<ProjectDetail>>(
      `/rovas/civic_project/${nid}${qs ? `?${qs}` : ""}`,
      accessToken ?? undefined,
    );
    return normalizeProjectDetail(body, projectNid);
  }

  /**
   * Paginated work reports for a project.
   * `GET /rovas/civic_project_work_reports?project_nid=&lang=`
   * Bearer optional — anonymous allowed for approved public-benefit / nonprofit projects.
   */
  async fetchProjectWorkReports(
    accessToken: string | null | undefined,
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
      accessToken ?? undefined,
    );
    return normalizeWorkReportPage(body, projectNid, limit, offset);
  }

  /**
   * Paginated project shareholders.
   * `GET /rovas/civic_project_shareholders?project_nid=`
   * Bearer optional — anonymous allowed for approved public-benefit / nonprofit projects.
   */
  async fetchProjectShareholders(
    accessToken: string | null | undefined,
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
      accessToken ?? undefined,
    );
    return normalizeShareholderPage(body, projectNid, limit, offset);
  }

  /**
   * Up to 3 projects where the Bearer user filed work reports most recently.
   * `GET /rovas/civic_my_projects?lang=`
   */
  async fetchMyProjects(
    accessToken: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<VolunteerProjectRow[]> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<unknown>(
      `/rovas/civic_my_projects${qs ? `?${qs}` : ""}`,
      accessToken,
    );
    return normalizeVolunteerProjectRows(body);
  }

  /**
   * Project title typeahead. Param is `query` (never `q`).
   * `GET /rovas/civic_projects_search?query=&lang=`
   */
  async searchProjects(
    accessToken: string,
    q: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<VolunteerProjectRow[]> {
    const params = new URLSearchParams({ query: q });
    appendLangParam(params, opts?.lang);
    const body = await this.getJson<unknown>(
      `/rovas/civic_projects_search?${params}`,
      accessToken,
    );
    return normalizeVolunteerProjectRows(body);
  }

  /**
   * Nested NACE tree. `GET /rovas/civic_nace_tree?lang=`
   */
  async fetchNaceTree(
    accessToken?: string | null,
    opts?: { lang?: CivicContentLang },
  ): Promise<NaceNode[]> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<unknown>(
      `/rovas/civic_nace_tree${qs ? `?${qs}` : ""}`,
      accessToken ?? undefined,
    );
    return normalizeNaceTree(body);
  }

  /**
   * Classify NACE (+ optional title) from work description.
   * `POST /rovas/civic_ai_nace`
   */
  async classifyNaceFromDescription(
    accessToken: string,
    payload: {
      description: string;
      lang?: CivicContentLang;
      project_nid?: string;
    },
  ): Promise<ClassifyNaceResponse> {
    try {
      const body = await this.postJson<unknown>(
        "/rovas/civic_ai_nace",
        accessToken,
        {
          description: payload.description,
          ...(payload.lang ? { lang: payload.lang } : {}),
          ...(payload.project_nid ? { project_nid: payload.project_nid } : {}),
        },
      );
      return normalizeClassifyNaceResponse(body);
    } catch (err) {
      if (
        err instanceof RovasClientError &&
        (err.status === 404 || err.status === 503)
      ) {
        return emptyClassifyNaceResponse("unavailable");
      }
      throw err;
    }
  }

  /**
   * Create a Public for-sale project.
   * `POST /rovas/civic_create_project`
   */
  async createProject(
    accessToken: string,
    payload: CreateProjectBody,
  ): Promise<{ project_nid: string }> {
    const body = await this.postJson<Partial<{ project_nid: string }>>(
      "/rovas/civic_create_project",
      accessToken,
      payload,
    );
    const nid =
      body.project_nid != null ? String(body.project_nid).trim() : "";
    if (!/^\d+$/.test(nid) || nid === "0") {
      throw new RovasClientError(
        "Rovas create_project missing project_nid",
        502,
        body,
      );
    }
    return { project_nid: nid };
  }

  /**
   * Donor-add public-benefit / nonprofit organisation + linked project.
   * `POST /rovas/civic_create_charity_org`
   */
  async createCharityOrg(
    accessToken: string,
    payload: CreateCharityOrgBody,
  ): Promise<CreateCharityOrgSuccess> {
    const body = await this.postJson<Partial<CreateCharityOrgSuccess>>(
      "/rovas/civic_create_charity_org",
      accessToken,
      payload,
    );
    const orgNid =
      body.organization_nid != null
        ? String(body.organization_nid).trim()
        : "";
    const projectNid =
      body.project_nid != null ? String(body.project_nid).trim() : "";
    const status =
      body.status === "approved" || body.status === "pending"
        ? body.status
        : null;
    const ownership =
      body.ownership === "custodial" || body.ownership === "submitter"
        ? body.ownership
        : null;
    const organization =
      typeof body.organization === "string" ? body.organization.trim() : "";
    if (
      !/^\d+$/.test(orgNid) ||
      orgNid === "0" ||
      !/^\d+$/.test(projectNid) ||
      projectNid === "0" ||
      !status ||
      !ownership ||
      !organization
    ) {
      throw new RovasClientError(
        "Rovas create_charity_org missing required fields",
        502,
        body,
      );
    }
    return {
      ok: true,
      status,
      created: Boolean(body.created),
      organization_nid: orgNid,
      project_nid: projectNid,
      organization,
      ownership,
    };
  }

  /**
   * Map widget config for volunteer work-report map proof.
   * `GET /rovas/civic_work_report_map_config`
   */
  async fetchWorkReportMapConfig(
    accessToken: string,
  ): Promise<WorkReportMapConfig> {
    return this.getJson("/rovas/civic_work_report_map_config", accessToken);
  }

  /**
   * Create a volunteer work report.
   * `POST /rovas/civic_create_work_report`
   */
  async createWorkReport(
    accessToken: string,
    payload: CreateWorkReportBody,
  ): Promise<{ work_report_nid: string; reward_kind: RewardKind }> {
    const body = await this.postJson<
      Partial<{ work_report_nid: string; reward_kind: string }>
    >("/rovas/civic_create_work_report", accessToken, payload);
    const nid =
      body.work_report_nid != null ? String(body.work_report_nid).trim() : "";
    if (!/^\d+$/.test(nid) || nid === "0") {
      throw new RovasClientError(
        "Rovas create_work_report missing work_report_nid",
        502,
        body,
      );
    }
    const kind = body.reward_kind === "merits" ? "merits" : "chrons";
    return { work_report_nid: nid, reward_kind: kind };
  }

  /**
   * Pending watched-comment notices for in-app notifications.
   * `GET /rovas/civic_pending_comment_notices`
   */
  async fetchPendingCommentNotices(
    accessToken: string,
  ): Promise<{
    total: number;
    items: import("@civic/shared").PendingCommentNoticeItem[];
  }> {
    const body = await this.getJson<{
      total?: unknown;
      items?: unknown;
    }>("/rovas/civic_pending_comment_notices", accessToken);
    const items = Array.isArray(body.items)
      ? body.items
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null;
            const r = raw as Record<string, unknown>;
            const nid = r.nid != null ? String(r.nid).trim() : "";
            const cid = r.cid != null ? String(r.cid).trim() : "";
            const nodeTitle =
              typeof r.node_title === "string" ? r.node_title.trim() : "";
            const commentUrl =
              typeof r.comment_url === "string" ? r.comment_url.trim() : "";
            const created =
              typeof r.created === "number"
                ? r.created
                : typeof r.created === "string" && /^\d+$/.test(r.created)
                  ? Number(r.created)
                  : NaN;
            if (
              !/^\d+$/.test(nid) ||
              !/^\d+$/.test(cid) ||
              !nodeTitle ||
              !commentUrl ||
              !Number.isFinite(created)
            ) {
              return null;
            }
            return {
              nid,
              node_title: nodeTitle,
              cid,
              comment_url: commentUrl,
              created,
            };
          })
          .filter(
            (x): x is import("@civic/shared").PendingCommentNoticeItem =>
              x != null,
          )
      : [];
    return {
      total: typeof body.total === "number" ? body.total : items.length,
      items,
    };
  }

  /**
   * Pending verification slots for in-app notifications.
   * `GET /rovas/civic_pending_verifications?lang=`
   */
  async fetchPendingVerifications(
    accessToken: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<{ total: number; items: import("@civic/shared").PendingVerificationItem[] }> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<{
      total?: unknown;
      items?: unknown;
    }>(
      `/rovas/civic_pending_verifications${qs ? `?${qs}` : ""}`,
      accessToken,
    );
    const items = Array.isArray(body.items)
      ? body.items
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null;
            const r = raw as Record<string, unknown>;
            const slotNid = r.slot_nid != null ? String(r.slot_nid).trim() : "";
            const wrNid =
              r.work_report_nid != null ? String(r.work_report_nid).trim() : "";
            const title = typeof r.title === "string" ? r.title.trim() : "";
            if (!/^\d+$/.test(slotNid) || !/^\d+$/.test(wrNid) || !title) {
              return null;
            }
            return {
              slot_nid: slotNid,
              work_report_nid: wrNid,
              title,
              author_username:
                typeof r.author_username === "string" && r.author_username
                  ? r.author_username
                  : null,
              author_display_name:
                typeof r.author_display_name === "string" &&
                r.author_display_name
                  ? r.author_display_name
                  : null,
              project_nid:
                r.project_nid != null && String(r.project_nid).trim()
                  ? String(r.project_nid).trim()
                  : null,
              assigned_at:
                typeof r.assigned_at === "string" && r.assigned_at
                  ? r.assigned_at
                  : null,
            };
          })
          .filter(
            (x): x is import("@civic/shared").PendingVerificationItem =>
              x != null,
          )
      : [];
    return {
      total: typeof body.total === "number" ? body.total : items.length,
      items,
    };
  }

  /**
   * Single work report for verify screen.
   * `GET /rovas/civic_work_report/{nid}?lang=`
   */
  async fetchWorkReportByNid(
    accessToken: string,
    workReportNid: string,
    opts?: { lang?: CivicContentLang },
  ): Promise<import("@civic/shared").WorkReportDetail> {
    const params = new URLSearchParams();
    appendLangParam(params, opts?.lang);
    const qs = params.toString();
    const body = await this.getJson<unknown>(
      `/rovas/civic_work_report/${encodeURIComponent(workReportNid)}${qs ? `?${qs}` : ""}`,
      accessToken,
    );
    const detail = normalizeWorkReportDetail(body);
    if (!detail) {
      throw new RovasClientError("Invalid work report response", 502, body);
    }
    return detail;
  }

  /**
   * Submit approve / reject / decline for an assigned verification slot.
   * `POST /rovas/civic_submit_verification`
   */
  async submitVerification(
    accessToken: string,
    slotNid: string,
    payload: import("@civic/shared").SubmitVerificationBody,
  ): Promise<{
    verification_nid?: string;
    work_report_nid: string;
    verdict: import("@civic/shared").VerificationVerdict;
  }> {
    const body = await this.postJson<
      Partial<{
        ok: boolean;
        verification_nid: string;
        work_report_nid: string;
        verdict: string;
      }>
    >("/rovas/civic_submit_verification", accessToken, {
      slot_nid: slotNid,
      ...payload,
    });
    const wrNid =
      body.work_report_nid != null ? String(body.work_report_nid).trim() : "";
    const verdict = body.verdict;
    if (
      !body.ok ||
      !/^\d+$/.test(wrNid) ||
      (verdict !== "approve" && verdict !== "reject" && verdict !== "decline")
    ) {
      throw new RovasClientError("Rovas submit_verification failed", 502, body);
    }
    const verificationNid =
      body.verification_nid != null
        ? String(body.verification_nid).trim()
        : undefined;
    return {
      ...(verificationNid && /^\d+$/.test(verificationNid)
        ? { verification_nid: verificationNid }
        : {}),
      work_report_nid: wrNid,
      verdict,
    };
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
   * (+ optional merchant / date / VAT filters — see civic-claims-filters).
   */
  async fetchClaims(
    accessToken: string,
    view: ReceiptHistoryView,
    opts?: { limit?: number; offset?: number } & ReceiptHistoryFilters,
  ): Promise<ReceiptSubmittedHistory | ReceiptReceivedHistory> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const params = new URLSearchParams({
      view,
      limit: String(limit),
      offset: String(offset),
    });
    const merchant = opts?.merchant?.trim();
    if (merchant) params.set("merchant", merchant);
    if (opts?.date_from) params.set("date_from", opts.date_from);
    if (opts?.date_to) params.set("date_to", opts.date_to);
    if (view === "submitted") {
      if (opts?.min_vat_eur != null) {
        params.set("min_vat_eur", String(opts.min_vat_eur));
      }
      if (opts?.max_vat_eur != null) {
        params.set("max_vat_eur", String(opts.max_vat_eur));
      }
    }
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

  /**
   * Set receipt scanning-history retention.
   * `POST /rovas/civic_receipt_history_preference`
   */
  async setReceiptHistoryPreference(
    accessToken: string,
    retention: RovasReceiptHistoryRetention,
  ): Promise<RovasReceiptHistoryPreferenceResult> {
    const body = await this.postJson<
      Partial<RovasReceiptHistoryPreferenceResult>
    >("/rovas/civic_receipt_history_preference", accessToken, { retention });
    const parsed = parseReceiptHistoryRetention(body.receipt_history_retention);
    if (!parsed) {
      throw new RovasClientError(
        "Rovas receipt history preference response missing retention",
        502,
      );
    }
    return {
      receipt_history_retention: parsed,
      scrubbed_claims:
        typeof body.scrubbed_claims === "number" &&
        Number.isFinite(body.scrubbed_claims)
          ? Math.max(0, Math.floor(body.scrubbed_claims))
          : 0,
    };
  }

  /**
   * Set ME sources share preference (who may see Taxes vs Gifts detail).
   * `POST /rovas/civic_me_sources_preference`
   */
  async setMeSourcesPreference(
    accessToken: string,
    share: MeSourcesShare,
  ): Promise<RovasMeSourcesPreferenceResult> {
    const body = await this.postJson<Partial<RovasMeSourcesPreferenceResult>>(
      "/rovas/civic_me_sources_preference",
      accessToken,
      { share },
    );
    const parsed = parseMeSourcesShareStrict(body.me_sources_share);
    if (!parsed) {
      throw new RovasClientError(
        "Rovas me sources preference response missing share",
        502,
      );
    }
    return { me_sources_share: parsed };
  }

  /**
   * Permanently dismiss Trusted congratulations banner.
   * `POST /rovas/civic_dismiss_trusted_notify`
   */
  async dismissTrustedNotify(
    accessToken: string,
  ): Promise<RovasDismissTrustedNotifyResult> {
    const body = await this.postJson<Partial<RovasDismissTrustedNotifyResult>>(
      "/rovas/civic_dismiss_trusted_notify",
      accessToken,
      {},
    );
    return {
      trusted_user: body.trusted_user === true,
      trusted_notify: parseTrustedNotify(body.trusted_notify),
    };
  }

  /**
   * Convert Chrons to Merits (1:1).
   * `POST /rovas/civic_give_chrons`
   */
  async giveChrons(
    accessToken: string,
    amount: number,
  ): Promise<RovasGiveChronsResult> {
    const body = await this.postJson<Partial<RovasGiveChronsResult>>(
      "/rovas/civic_give_chrons",
      accessToken,
      { amount },
    );
    const chronsGiven = Number(body.chrons_given);
    const meritsGained = Number(body.merits_gained);
    const totalChr = Number(body.total_chr);
    const totalMe = Number(body.total_me);
    if (
      !Number.isFinite(chronsGiven) ||
      !Number.isFinite(meritsGained) ||
      !Number.isFinite(totalChr) ||
      !Number.isFinite(totalMe)
    ) {
      throw new RovasClientError(
        "Rovas give-chrons response missing required fields",
        502,
      );
    }
    return {
      chrons_given: chronsGiven,
      merits_gained: meritsGained,
      total_chr: totalChr,
      total_me: totalMe,
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
    if (res.status === 403) {
      throw new RovasClientError(
        volunteerErrorMessage(parsed, `Rovas forbidden (${path})`),
        403,
        parsed,
      );
    }
    if (res.status === 400) {
      throw new RovasClientError(
        volunteerErrorMessage(parsed, `Rovas bad request (${path})`),
        400,
        parsed,
      );
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
  bySource?: unknown,
  detail: MeSourcesDetail = "detailed",
): ContributionCategoryBreakdown {
  if (detail === "aggregate") {
    const taxes = Number(raw?.taxes) || 0;
    const charity = Number(raw?.charity) || 0;
    const volunteer = Number(raw?.volunteer) || 0;
    const combined = Number(raw?.taxes_and_gifts);
    return {
      taxes: 0,
      charity: 0,
      volunteer,
      taxes_and_gifts: Number.isFinite(combined) ? combined : taxes + charity,
    };
  }
  return resolveContributionCategories(
    raw,
    normalizeMeritSources(bySource),
  );
}

/** Sparse Rovas `by_source` map; returns undefined when absent/empty. */
function normalizeMeritSources(
  raw: unknown,
): MeritSourceBreakdown | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: MeritSourceBreakdown = {};
  let saw = false;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const me = Number(value);
    if (!key || !Number.isFinite(me)) continue;
    out[key] = me;
    saw = true;
  }
  return saw ? out : undefined;
}

function normalizeNaceExpertise(raw: unknown): NaceExpertiseSection[] {
  if (!Array.isArray(raw)) return [];
  const out: NaceExpertiseSection[] = [];
  for (const row of raw) {
    const r = row as Partial<NaceExpertiseSection>;
    const section_tid = Number(r.section_tid);
    const section_label =
      typeof r.section_label === "string" ? r.section_label.trim() : "";
    const icon_url = typeof r.icon_url === "string" ? r.icon_url.trim() : "";
    const me = Number(r.me);
    if (!Number.isFinite(section_tid) || !section_label || !icon_url || !Number.isFinite(me)) {
      continue;
    }
    const section_letter =
      typeof r.section_letter === "string" && r.section_letter
        ? r.section_letter.toLowerCase()
        : section_label.charAt(0).toLowerCase();
    const share_percent = Number(r.share_percent);
    const hourly_rate_eur = Number(r.hourly_rate_eur);
    out.push({
      section_tid,
      section_label,
      section_letter,
      icon_url,
      me,
      share_percent: Number.isFinite(share_percent) ? share_percent : 0,
      hourly_rate_eur: Number.isFinite(hourly_rate_eur) ? hourly_rate_eur : 10,
    });
  }
  return out;
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
    is_charity: Boolean(raw.is_charity),
    charity_status: normalizeCharityStatus(raw.charity_status),
    organization:
      typeof raw.organization === "string" && raw.organization.trim()
        ? raw.organization.trim()
        : null,
    donate_instructions:
      typeof raw.donate_instructions === "string" && raw.donate_instructions.trim()
        ? raw.donate_instructions.trim()
        : null,
    donate_url:
      typeof raw.donate_url === "string" && raw.donate_url.trim()
        ? raw.donate_url.trim()
        : null,
    donate_iban: compactIbanOrNull(raw.donate_iban),
    iban_verified:
      typeof raw.iban_verified === "boolean" ? raw.iban_verified : null,
    org_id:
      typeof raw.org_id === "string" && raw.org_id.trim()
        ? raw.org_id.trim()
        : null,
    country:
      typeof raw.country === "string" && /^[A-Za-z]{2}$/.test(raw.country.trim())
        ? raw.country.trim().toUpperCase()
        : null,
    website_url:
      typeof raw.website_url === "string" && raw.website_url.trim()
        ? raw.website_url.trim()
        : null,
  };
}

function normalizeCharityStatus(
  raw: unknown,
): "approved" | "pending" | null {
  if (raw === "approved" || raw === "pending") return raw;
  return null;
}

function normalizeCharityProjectRow(raw: unknown): CharityProject | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const projectNid = nidOrNull(r.project_nid);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!projectNid || !title) return null;
  const organization =
    typeof r.organization === "string" && r.organization.trim()
      ? r.organization.trim()
      : title;
  const summary =
    typeof r.summary === "string" && r.summary.trim() ? r.summary.trim() : "";
  const totalMe = Number(r.total_me);
  return {
    id: projectNid,
    project_nid: projectNid,
    title,
    organization,
    summary,
    rovas_url:
      typeof r.rovas_url === "string" && r.rovas_url.trim()
        ? r.rovas_url.trim()
        : "",
    type: "charity",
    total_me: Number.isFinite(totalMe) ? totalMe : 0,
  };
}

function normalizeCharityProjectsResponse(raw: {
  total?: unknown;
  projects?: unknown;
}): CharityProjectsResponse {
  const projects = Array.isArray(raw?.projects)
    ? raw.projects
        .map(normalizeCharityProjectRow)
        .filter((p): p is CharityProject => p != null)
    : [];
  const total =
    typeof raw?.total === "number" && Number.isFinite(raw.total)
      ? Math.max(0, Math.trunc(raw.total))
      : projects.length;
  return { total, projects };
}

function nidOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s && s !== "0" ? s : null;
}

function normalizeMeritHistoryItem(raw: unknown): MeritHistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MeritHistoryItem>;
  const disbursementNid = nidOrNull(r.disbursement_nid);
  const merits = Number(r.merits);
  if (!disbursementNid || !Number.isFinite(merits)) return null;
  const kind: MeritHistorySourceKind =
    r.source_kind === "project" ||
    r.source_kind === "report" ||
    r.source_kind === "purchase"
      ? r.source_kind
      : "purchase";
  const nodeType =
    r.node_type === "merit_penalty" ? "merit_penalty" : "merits_disbursement";
  const title =
    typeof r.source_title === "string" && r.source_title.trim()
      ? r.source_title.trim()
      : null;
  return {
    disbursement_nid: disbursementNid,
    node_type: nodeType,
    created_at:
      typeof r.created_at === "string" && r.created_at ? r.created_at : "",
    merits,
    source_kind: kind,
    source_title: kind === "purchase" ? null : title,
    project_nid: nidOrNull(r.project_nid),
    work_report_nid: nidOrNull(r.work_report_nid),
  };
}

function normalizeMeritHistoryPage(
  raw: Partial<MeritHistoryPage> | undefined,
  fallbackLimit: number,
  fallbackOffset: number,
): MeritHistoryPage {
  if (!Array.isArray(raw?.items) || typeof raw?.total !== "number") {
    throw new RovasClientError(
      "Rovas civic_merit_history missing items/total",
      502,
      raw,
    );
  }
  const items = raw.items
    .map(normalizeMeritHistoryItem)
    .filter((x): x is MeritHistoryItem => x != null);
  return {
    total: raw.total,
    limit: typeof raw.limit === "number" ? raw.limit : fallbackLimit,
    offset: typeof raw.offset === "number" ? raw.offset : fallbackOffset,
    items,
  };
}

const MERIT_INDEX_SORTS: MeritIndexSort[] = [
  "position",
  "total_me",
  "value_eur",
  "member_since",
  "country",
  "taxes_me",
  "charity_me",
  "volunteer_me",
];

function normalizeMeritIndexRow(raw: unknown): MeritIndexRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MeritIndexRow>;
  const uid = r.rovas_uid != null ? String(r.rovas_uid) : "";
  const username = typeof r.username === "string" ? r.username : "";
  const totalMe = Number(r.total_me);
  const valueEur = Number(r.value_eur);
  const position = Number(r.position);
  const sinceYear = Number(r.member_since_year);
  if (!uid || !username || !Number.isFinite(totalMe) || !Number.isFinite(position)) {
    return null;
  }
  return {
    position,
    rovas_uid: uid,
    username,
    display_name:
      typeof r.display_name === "string" && r.display_name
        ? r.display_name
        : username,
    member_since_year: Number.isFinite(sinceYear) ? sinceYear : 0,
    total_me: totalMe,
    value_eur: Number.isFinite(valueEur) ? valueEur : 0,
    country_iso2:
      typeof r.country_iso2 === "string" && r.country_iso2
        ? r.country_iso2.toUpperCase()
        : null,
    country_label:
      typeof r.country_label === "string" && r.country_label
        ? r.country_label
        : null,
    ...(() => {
      const detail = parseMeSourcesDetail(
        (r as { me_sources_detail?: unknown }).me_sources_detail,
      );
      return {
        by_category: normalizeCategories(
          r.by_category,
          (r as { by_source?: unknown }).by_source,
          detail,
        ),
        me_sources_detail: detail,
      };
    })(),
    nace_expertise: normalizeNaceExpertise(r.nace_expertise),
  };
}

function normalizeMeritIndexCountries(raw: unknown): MeritIndexCountry[] {
  if (!Array.isArray(raw)) return [];
  const out: MeritIndexCountry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<MeritIndexCountry>;
    const iso2 =
      typeof r.iso2 === "string" && r.iso2.trim()
        ? r.iso2.trim().toUpperCase()
        : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!iso2 || !label) continue;
    const userCount = Number(r.user_count);
    out.push({
      iso2,
      label,
      user_count: Number.isFinite(userCount) ? userCount : 0,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

const SPOTLIGHT_PERIODS: MeritSpotlightPeriod[] = [
  "today",
  "day",
  "week",
  "month",
];
const SPOTLIGHT_CATEGORIES: MeritSourceCategory[] = [
  "taxes",
  "charity",
  "volunteer",
];

function normalizeSpotlightPeriod(
  raw: string | undefined,
): MeritSpotlightPeriod {
  if (raw && SPOTLIGHT_PERIODS.includes(raw as MeritSpotlightPeriod)) {
    return raw as MeritSpotlightPeriod;
  }
  return "week";
}

function emptyMeritSpotlight(
  period: MeritSpotlightPeriod,
  country_iso2: string | null,
): MeritSpotlight {
  return {
    period,
    period_start: "",
    period_end: "",
    country_iso2,
    community_earned_me: 0,
    active_earners: 0,
    leads: [],
  };
}

function normalizeSpotlightLead(raw: unknown): MeritSpotlightLead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MeritSpotlightLead>;
  if (
    !r.category ||
    !SPOTLIGHT_CATEGORIES.includes(r.category as MeritSourceCategory)
  ) {
    return null;
  }
  const username = typeof r.username === "string" ? r.username.trim() : "";
  if (!username) return null;
  const earned = Number(r.earned_me);
  // Round the same way the UI displays ME — drop sub-0.5 amounts that show as "0 ME".
  if (!Number.isFinite(earned) || displayMerits(earned) <= 0) return null;
  return {
    category: r.category as MeritSourceCategory,
    earned_me: earned,
    rovas_uid: r.rovas_uid != null ? String(r.rovas_uid) : "",
    username,
    display_name:
      typeof r.display_name === "string" && r.display_name.trim()
        ? r.display_name.trim()
        : username,
    country_iso2:
      typeof r.country_iso2 === "string" && r.country_iso2.trim()
        ? r.country_iso2.trim().toUpperCase()
        : null,
  };
}

function normalizeSpotlightYou(raw: unknown): MeritSpotlightYou | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<MeritSpotlightYou> & {
    by_category?: Partial<ContributionCategoryBreakdown>;
    by_source?: MeritSourceBreakdown;
  };
  const by = resolveContributionCategories(r.by_category, r.by_source);
  const isLead = Array.isArray(r.is_lead_for)
    ? r.is_lead_for.filter((c): c is MeritSourceCategory =>
        SPOTLIGHT_CATEGORIES.includes(c as MeritSourceCategory),
      )
    : [];
  return {
    earned_me: Number(r.earned_me) || 0,
    by_category: by,
    earned_today_me: Number(r.earned_today_me) || 0,
    is_lead_for: isLead,
  };
}

function normalizeMeritSpotlight(
  raw: Partial<MeritSpotlight> | undefined,
  fallbackPeriod: MeritSpotlightPeriod,
  fallbackCountry: string | null,
): MeritSpotlight {
  const period = normalizeSpotlightPeriod(
    typeof raw?.period === "string" ? raw.period : fallbackPeriod,
  );
  const leads = Array.isArray(raw?.leads)
    ? raw.leads
        .map(normalizeSpotlightLead)
        .filter((x): x is MeritSpotlightLead => x != null)
        .sort(
          (a, b) =>
            SPOTLIGHT_CATEGORIES.indexOf(a.category) -
            SPOTLIGHT_CATEGORIES.indexOf(b.category),
        )
    : [];
  const you = normalizeSpotlightYou(raw?.you);
  return {
    period,
    period_start:
      typeof raw?.period_start === "string" ? raw.period_start : "",
    period_end: typeof raw?.period_end === "string" ? raw.period_end : "",
    country_iso2:
      typeof raw?.country_iso2 === "string" && raw.country_iso2.trim()
        ? raw.country_iso2.trim().toUpperCase()
        : fallbackCountry,
    community_earned_me: Number(raw?.community_earned_me) || 0,
    active_earners: Number(raw?.active_earners) || 0,
    leads,
    ...(you ? { you } : {}),
  };
}

function emptyMeritIndexPage(
  limit: number,
  offset: number,
  period?: MeritSpotlightPeriod,
): MeritIndexPage {
  return {
    total: 0,
    limit,
    offset,
    sort: "total_me",
    order: "desc",
    items: [],
    ...(period
      ? { period, period_start: "", period_end: "" }
      : {}),
  };
}

function normalizeMeritIndexPage(
  raw: Partial<MeritIndexPage> | undefined,
  fallbackLimit: number,
  fallbackOffset: number,
  periodFallback?: MeritSpotlightPeriod,
): MeritIndexPage {
  if (!Array.isArray(raw?.items) || typeof raw?.total !== "number") {
    throw new RovasClientError(
      "Rovas civic_merit_index missing items/total",
      502,
      raw,
    );
  }
  const sort =
    typeof raw.sort === "string" &&
    MERIT_INDEX_SORTS.includes(raw.sort as MeritIndexSort)
      ? (raw.sort as MeritIndexSort)
      : "total_me";
  const order: MeritIndexOrder = raw.order === "asc" ? "asc" : "desc";
  const items = raw.items
    .map(normalizeMeritIndexRow)
    .filter((x): x is MeritIndexRow => x != null)
    .filter((row) => displayMerits(row.total_me) > 0);
  const period =
    raw.period === "day" || raw.period === "week" || raw.period === "month"
      ? raw.period
      : periodFallback;
  return {
    total: raw.total,
    limit: typeof raw.limit === "number" ? raw.limit : fallbackLimit,
    offset: typeof raw.offset === "number" ? raw.offset : fallbackOffset,
    sort,
    order,
    items,
    ...(raw.privacy_filter_active === true
      ? { privacy_filter_active: true }
      : {}),
    ...(period
      ? {
          period,
          period_start:
            typeof raw.period_start === "string" ? raw.period_start : undefined,
          period_end:
            typeof raw.period_end === "string" ? raw.period_end : undefined,
        }
      : {}),
  };
}

function volunteerErrorMessage(parsed: unknown, fallback: string): string {
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  if (parsed && typeof parsed === "object") {
    const o = parsed as { error?: unknown; message?: unknown };
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.trim();
    }
    if (typeof o.error === "string" && o.error.trim()) {
      return o.error.trim();
    }
  }
  return fallback;
}

/** Map a Rovas error body/message to a Civic volunteer error code. */
export function volunteerErrorCodeFromRovas(
  err: RovasClientError,
): CreateWorkReportErrorCode {
  const blob = [
    err.message,
    typeof err.body === "string" ? err.body : "",
    err.body && typeof err.body === "object"
      ? JSON.stringify(err.body)
      : "",
  ]
    .join(" ")
    .toLowerCase();
  if (blob.includes("not_shareholder")) return "not_shareholder";
  if (blob.includes("date_before_registration")) {
    return "date_before_registration";
  }
  if (
    blob.includes("date_reporting_window_expired") ||
    blob.includes("reporting_window")
  ) {
    return "date_reporting_window_expired";
  }
  if (blob.includes("pending_verifications")) return "pending_verifications";
  if (blob.includes("project_not_found") || err.status === 404) {
    return "project_not_found";
  }
  if (err.status === 401) return "unauthorized";
  if (err.status === 400) return "invalid_input";
  if (err.status === 403) return "not_shareholder";
  return "rovas_error";
}

/** Map Rovas verification submit errors to Civic codes. */
export function verificationErrorCodeFromRovas(
  err: RovasClientError,
): import("@civic/shared").SubmitVerificationErrorCode {
  const blob = [
    err.message,
    typeof err.body === "string" ? err.body : "",
    err.body && typeof err.body === "object"
      ? JSON.stringify(err.body)
      : "",
  ]
    .join(" ")
    .toLowerCase();
  if (blob.includes("already_verified")) return "already_verified";
  if (blob.includes("not_verifiable")) return "not_verifiable";
  if (blob.includes("cannot_decline")) return "cannot_decline";
  if (blob.includes("not_assigned")) return "not_assigned";
  if (err.status === 404 || blob.includes("not_found")) return "not_found";
  if (err.status === 401) return "unauthorized";
  if (err.status === 400) return "invalid_input";
  if (err.status === 403) return "not_assigned";
  return "rovas_error";
}

function parseReceiptHistoryRetention(
  value: unknown,
): RovasReceiptHistoryRetention | null {
  return value === "keep" || value === "policy" ? value : null;
}

/** Unset / unknown → 0 (do not show banner). */
function parseTrustedNotify(value: unknown): 0 | 1 | 2 {
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  return 0;
}

/** Unset / unknown → everyone (Rovas default). */
function parseMeSourcesShare(value: unknown): MeSourcesShare {
  return value === "reciprocal" || value === "aggregate" || value === "everyone"
    ? value
    : "everyone";
}

function parseMeSourcesShareStrict(value: unknown): MeSourcesShare | null {
  return value === "everyone" || value === "reciprocal" || value === "aggregate"
    ? value
    : null;
}

/** Unset → detailed (pre-privacy Rovas or self). */
function parseMeSourcesDetail(value: unknown): MeSourcesDetail {
  return value === "aggregate" ? "aggregate" : "detailed";
}

function unwrapList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const o = body as { results?: unknown; projects?: unknown; tree?: unknown };
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.projects)) return o.projects;
    if (Array.isArray(o.tree)) return o.tree;
  }
  return [];
}

function normalizeVolunteerProjectRows(body: unknown): VolunteerProjectRow[] {
  return unwrapList(body)
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Partial<VolunteerProjectRow>;
      const nid = r.project_nid != null ? String(r.project_nid) : "";
      const title = typeof r.title === "string" ? r.title.trim() : "";
      if (!/^\d+$/.test(nid) || nid === "0" || !title) return null;
      return {
        project_nid: nid,
        title,
        is_public: Boolean(r.is_public),
        can_report: r.can_report !== false,
      };
    })
    .filter((x): x is VolunteerProjectRow => x != null);
}

function normalizeNaceNode(raw: unknown): NaceNode | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<NaceNode> & { children?: unknown };
  const tid = r.tid != null ? String(r.tid) : "";
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!/^\d+$/.test(tid) || tid === "0" || !label) return null;
  const children = Array.isArray(r.children)
    ? r.children
        .map(normalizeNaceNode)
        .filter((x): x is NaceNode => x != null)
    : [];
  return {
    tid,
    code: typeof r.code === "string" ? r.code : "",
    label,
    children,
  };
}

function normalizeNaceTree(body: unknown): NaceNode[] {
  return unwrapList(body)
    .map(normalizeNaceNode)
    .filter((x): x is NaceNode => x != null);
}

const AI_NACE_STATUSES = new Set<AiNaceStatus>([
  "ok",
  "need_more_info",
  "unavailable",
  "error",
]);

function emptyClassifyNaceResponse(status: AiNaceStatus): ClassifyNaceResponse {
  return {
    status,
    nace_tid: "",
    nace_code: "",
    nace_label: "",
    title: "",
    clarifying_question: "",
    confidence: 0,
    error: "",
  };
}

function normalizeClassifyNaceResponse(body: unknown): ClassifyNaceResponse {
  if (!body || typeof body !== "object") {
    return emptyClassifyNaceResponse("error");
  }
  const r = body as Partial<ClassifyNaceResponse>;
  const statusRaw = typeof r.status === "string" ? r.status.trim() : "";
  const status = AI_NACE_STATUSES.has(statusRaw as AiNaceStatus)
    ? (statusRaw as AiNaceStatus)
    : "error";
  return {
    status,
    nace_tid: r.nace_tid != null ? String(r.nace_tid).trim() : "",
    nace_code: typeof r.nace_code === "string" ? r.nace_code.trim() : "",
    nace_label: typeof r.nace_label === "string" ? r.nace_label.trim() : "",
    title: typeof r.title === "string" ? r.title.trim() : "",
    clarifying_question:
      typeof r.clarifying_question === "string"
        ? r.clarifying_question.trim()
        : "",
    confidence:
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? r.confidence
        : 0,
    error: typeof r.error === "string" ? r.error.trim() : "",
  };
}
