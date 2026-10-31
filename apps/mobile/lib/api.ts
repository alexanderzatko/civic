import Constants from "expo-constants";
import type {
  CharityProjectsResponse,
  ClaimReceiptResponse,
  ClaimShareInput,
  ContributionsSummary,
  GeoLocation,
  MeritRate,
  ProjectDetail,
  ProjectShareholderPage,
  ProjectWorkReportPage,
  RankDistribution,
  ReceiptDetailResponse,
  ReceiptHistoryView,
  ReceiptReceivedHistory,
  ReceiptSubmittedHistory,
  UserSearchResult,
  UserLookup,
  VerifyReceiptResponse,
  MeritHistoryPage,
  MeritIndexCountry,
  MeritIndexFilters,
  MeritIndexPage,
  MeritSpotlight,
  MeritSpotlightFilters,
  GiveChronsResult,
  VolunteerProjectRow,
  NaceNode,
  ClassifyNaceBody,
  ClassifyNaceResponse,
  CreateProjectResponse,
  CreateCharityOrgBody,
  CreateCharityOrgResponse,
  CreateWorkReportBody,
  CreateWorkReportResponse,
  PendingVerificationsPage,
  PendingCommentNoticesPage,
  SubmitVerificationBody,
  SubmitVerificationResponse,
  WorkReportDetail,
  WorkReportFeeInfo,
  WorkReportMapConfig,
} from "@civic/shared";
import { getLocale } from "@/lib/i18n";

const fallbackUrl = "http://localhost:3001";

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    fallbackUrl
  );
}

/** Hostname only for Status UI (no secrets). */
export function getApiHostLabel(): string {
  try {
    return new URL(getApiBaseUrl()).host;
  } catch {
    return getApiBaseUrl();
  }
}

export type HealthResponse = {
  ok: boolean;
  civic_api: { ok: boolean };
  rovas: {
    ok: boolean;
    base_url?: string;
    error?: string;
  };
  formula_version?: number;
  wage_basis?: string;
  hourly_wage_eur?: number;
  merit_rate_source?: string;
  rovas_base_url?: string;
};

const HEALTH_TIMEOUT_MS = 12_000;

/**
 * Public Civic API health + Rovas probe. Transport failure ⇒ Civic unreachable.
 */
export async function fetchHealth(): Promise<{
  data: HealthResponse | null;
  latencyMs: number;
  error: string | null;
}> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiBaseUrl()}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        data: null,
        latencyMs,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as HealthResponse;
    return { data, latencyMs, error: null };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
          ? err.message.slice(0, 120)
          : "unreachable";
    return { data: null, latencyMs, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export type MeIdentity = {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  total_me?: number;
  /** Chron wallet when Rovas exposes `total_chr` on `/rovas/me`. */
  total_chr?: number;
  /** Rovas preferred language when exposed on `/rovas/me` (e.g. `sk`, `en`). */
  language?: string | null;
  /** Keep vs 90-day policy; `null` until answered (Rovas-backed). */
  receipt_history_retention?: "keep" | "policy" | null;
  /** Who may see Taxes vs Gifts detail; defaults to everyone. */
  me_sources_share?: "everyone" | "reciprocal" | "aggregate";
  client_id: string;
  scope: string | null;
  expires_at: number;
};

export type ReceiptHistoryPreferenceResult = {
  receipt_history_retention: "keep" | "policy";
  scrubbed_claims: number;
};

export type MeSourcesShare = "everyone" | "reciprocal" | "aggregate";

export type MeSourcesPreferenceResult = {
  me_sources_share: MeSourcesShare;
};

export type MyContributionsSummary = ContributionsSummary & {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  scope?: string;
};

type TokenGetter = () => Promise<string | null>;
type UnauthorizedHandler = () => Promise<string | null>;

type ApiFetchInit = RequestInit & {
  auth?: "required" | "optional" | false;
  /** Internal: one 401 retry after forced token refresh. */
  _authRetried?: boolean;
};

let getAccessToken: TokenGetter | null = null;
let handleUnauthorized: UnauthorizedHandler | null = null;

/** Register the auth-session token provider (called from AuthProvider). */
export function setAccessTokenGetter(getter: TokenGetter | null): void {
  getAccessToken = getter;
}

/** Register 401 handler — force refresh and allow one retry (AuthProvider). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  handleUnauthorized = handler;
}

async function apiFetch<T>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const mode = init?.auth ?? false;
  if (mode) {
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token && mode === "required") {
      const err = new Error("Not signed in") as Error & { status: number };
      err.status = 401;
      throw err;
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const { auth: _auth, _authRetried, ...rest } = init ?? {};
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers,
  });
  const body = (await res.json()) as T;
  if (!res.ok) {
    if (
      res.status === 401 &&
      mode &&
      !init?._authRetried &&
      handleUnauthorized
    ) {
      const newToken = await handleUnauthorized();
      if (newToken) {
        return apiFetch<T>(path, { ...init, _authRetried: true });
      }
    }
    const err = new Error(`API ${res.status}`) as Error & {
      status: number;
      body: T;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function verifyReceipt(qrOrUid: string): Promise<VerifyReceiptResponse> {
  return apiFetch<VerifyReceiptResponse>("/receipts/verify", {
    method: "POST",
    auth: "optional",
    body: JSON.stringify({ qr_or_uid: qrOrUid }),
  }).catch((err: Error & { body?: VerifyReceiptResponse }) => {
    if (err.body) return err.body;
    throw err;
  });
}

export function claimReceipt(
  qrOrUid: string,
  shares?: ClaimShareInput[],
  location?: GeoLocation,
): Promise<ClaimReceiptResponse> {
  return apiFetch<ClaimReceiptResponse>("/receipts/claim", {
    method: "POST",
    auth: "required",
    body: JSON.stringify({
      qr_or_uid: qrOrUid,
      ...(location ? { location } : {}),
      ...(shares && shares.length > 0 ? { shares } : {}),
    }),
  }).catch((err: Error & { body?: ClaimReceiptResponse; status?: number }) => {
    if (err.body && typeof err.body === "object" && "claimed" in err.body) {
      return err.body;
    }
    throw err;
  });
}

export function fetchReceiptHistory(
  view: "submitted",
  opts?: { limit?: number; offset?: number },
): Promise<ReceiptSubmittedHistory>;
export function fetchReceiptHistory(
  view: "received",
  opts?: { limit?: number; offset?: number },
): Promise<ReceiptReceivedHistory>;
export function fetchReceiptHistory(
  view: ReceiptHistoryView,
  opts?: { limit?: number; offset?: number },
): Promise<ReceiptSubmittedHistory | ReceiptReceivedHistory> {
  const params = new URLSearchParams({ view });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  return apiFetch(`/receipts?${params}`, { auth: "required" });
}

export function fetchReceiptDetail(
  receiptUid: string,
): Promise<ReceiptDetailResponse> {
  const params = new URLSearchParams({ receipt_uid: receiptUid });
  return apiFetch<ReceiptDetailResponse>(
    `/receipts/fs-detail?${params}`,
    { auth: "required" },
  ).catch((err: Error & { body?: ReceiptDetailResponse }) => {
    if (err.body && typeof err.body === "object" && "found" in err.body) {
      return err.body;
    }
    throw err;
  });
}

export function searchUsers(q: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q });
  return apiFetch<UserSearchResult[]>(`/users/search?${params}`, {
    auth: "required",
  });
}

export function lookupUser(username: string): Promise<UserLookup> {
  const params = new URLSearchParams({ username, lang: getLocale() });
  return apiFetch<UserLookup>(`/users/lookup?${params}`, {
    auth: "required",
  });
}

export function fetchMeritHistory(opts?: {
  limit?: number;
  offset?: number;
}): Promise<MeritHistoryPage> {
  const params = new URLSearchParams({ lang: getLocale() });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  return apiFetch<MeritHistoryPage>(`/users/me/merit-history?${params}`, {
    auth: "required",
  });
}

export function fetchMeritIndex(
  filters: MeritIndexFilters = {},
): Promise<MeritIndexPage> {
  const params = new URLSearchParams({ lang: getLocale() });
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.country_iso2) params.set("country_iso2", filters.country_iso2);
  if (filters.since_from) params.set("since_from", filters.since_from);
  if (filters.min_me != null) params.set("min_me", String(filters.min_me));
  if (filters.max_me != null) params.set("max_me", String(filters.max_me));
  if (filters.min_value_eur != null) {
    params.set("min_value_eur", String(filters.min_value_eur));
  }
  if (filters.max_value_eur != null) {
    params.set("max_value_eur", String(filters.max_value_eur));
  }
  if (filters.nace_section_tid != null) {
    params.set("nace_section_tid", String(filters.nace_section_tid));
  }
  if (filters.source_category) {
    params.set("source_category", filters.source_category);
  }
  if (filters.period) {
    params.set("period", filters.period);
  }
  return apiFetch<MeritIndexPage>(`/rank/index?${params}`, {
    auth: "optional",
  });
}

export function fetchMeritIndexCountries(): Promise<{
  countries: MeritIndexCountry[];
}> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch(`/rank/index/countries?${params}`, { auth: "optional" });
}

export function fetchMeritSpotlight(
  filters: MeritSpotlightFilters,
): Promise<MeritSpotlight> {
  const params = new URLSearchParams({
    lang: getLocale(),
    period: filters.period,
  });
  if (filters.country_iso2) {
    params.set("country_iso2", filters.country_iso2);
  }
  return apiFetch<MeritSpotlight>(`/rank/spotlight?${params}`, {
    auth: "optional",
  });
}

export function fetchProject(projectNid: string): Promise<ProjectDetail> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch<ProjectDetail>(
    `/projects/${encodeURIComponent(projectNid)}?${params}`,
    { auth: "optional" },
  );
}

export function fetchProjectWorkReports(
  projectNid: string,
  opts?: { limit?: number; offset?: number },
): Promise<ProjectWorkReportPage> {
  const params = new URLSearchParams({ lang: getLocale() });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  return apiFetch<ProjectWorkReportPage>(
    `/projects/${encodeURIComponent(projectNid)}/work-reports?${params}`,
    { auth: "optional" },
  );
}

export function fetchProjectShareholders(
  projectNid: string,
  opts?: { limit?: number; offset?: number },
): Promise<ProjectShareholderPage> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return apiFetch<ProjectShareholderPage>(
    `/projects/${encodeURIComponent(projectNid)}/shareholders${qs ? `?${qs}` : ""}`,
    { auth: "optional" },
  );
}

export function fetchMe(): Promise<MeIdentity> {
  return apiFetch("/me", { auth: "required" });
}

export function setReceiptHistoryPreference(
  retention: "keep" | "policy",
): Promise<ReceiptHistoryPreferenceResult> {
  return apiFetch<ReceiptHistoryPreferenceResult>(
    "/me/receipt-history-preference",
    {
      method: "POST",
      auth: "required",
      body: JSON.stringify({ retention }),
    },
  );
}

export function setMeSourcesPreference(
  share: MeSourcesShare,
): Promise<MeSourcesPreferenceResult> {
  return apiFetch<MeSourcesPreferenceResult>("/me/me-sources-preference", {
    method: "POST",
    auth: "required",
    body: JSON.stringify({ share }),
  });
}

/** Convert Chrons → Merits (1:1). Proxies Rovas `POST /rovas/civic_give_chrons`. */
export function giveChrons(amount: number): Promise<GiveChronsResult> {
  return apiFetch<GiveChronsResult>("/me/give-chrons", {
    method: "POST",
    auth: "required",
    body: JSON.stringify({ amount }),
  });
}

export function fetchMySummary(): Promise<MyContributionsSummary> {
  return apiFetch("/me/contributions/summary", { auth: "required" });
}

export function fetchCommunitySummary(): Promise<ContributionsSummary> {
  return apiFetch("/community/contributions/summary");
}

export function fetchRankDistribution(): Promise<RankDistribution> {
  return apiFetch("/rank/distribution", { auth: "optional" });
}

export function fetchMeritRate(): Promise<MeritRate> {
  return apiFetch("/merit-rate");
}

export function fetchProjects(
  type: "charity" | "invest",
  opts?: { query?: string; limit?: number },
): Promise<CharityProjectsResponse> {
  const params = new URLSearchParams({ type, lang: getLocale() });
  const q = opts?.query?.trim();
  if (q) params.set("query", q);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  return apiFetch(`/charities/projects?${params}`);
}

export function fetchMyProjects(): Promise<{ projects: VolunteerProjectRow[] }> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch(`/projects/mine?${params}`, { auth: "required" });
}

export function searchProjects(
  q: string,
): Promise<{ projects: VolunteerProjectRow[] }> {
  const params = new URLSearchParams({ q, lang: getLocale() });
  return apiFetch(`/projects/search?${params}`, { auth: "required" });
}

export function createProject(body: {
  name: string;
  description: string;
  url?: string;
}): Promise<CreateProjectResponse> {
  return apiFetch<CreateProjectResponse>("/projects", {
    method: "POST",
    auth: "required",
    body: JSON.stringify(body),
  }).catch((err: Error & { body?: CreateProjectResponse; status?: number }) => {
    if (err.body && typeof err.body === "object" && "ok" in err.body) {
      return err.body;
    }
    throw err;
  });
}

export function createCharityOrg(
  body: CreateCharityOrgBody,
): Promise<CreateCharityOrgResponse> {
  return apiFetch<CreateCharityOrgResponse>("/charities/organizations", {
    method: "POST",
    auth: "required",
    body: JSON.stringify(body),
  }).catch(
    (err: Error & { body?: CreateCharityOrgResponse; status?: number }) => {
      if (err.body && typeof err.body === "object" && "ok" in err.body) {
        return err.body;
      }
      throw err;
    },
  );
}

export function fetchNaceTree(): Promise<{ tree: NaceNode[] }> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch(`/nace?${params}`, { auth: "optional" });
}

export function classifyNaceFromDescription(
  body: ClassifyNaceBody,
): Promise<ClassifyNaceResponse> {
  return apiFetch<ClassifyNaceResponse>("/nace/classify", {
    method: "POST",
    auth: "required",
    body: JSON.stringify({ ...body, lang: body.lang ?? getLocale() }),
  });
}

export function fetchWorkReportMapConfig(): Promise<WorkReportMapConfig> {
  return apiFetch("/work-reports/map-config", { auth: "required" });
}

export function fetchWorkReportFeeInfo(): Promise<WorkReportFeeInfo> {
  return apiFetch("/work-reports/fee-info", { auth: "optional" });
}

export function createWorkReport(
  body: CreateWorkReportBody,
): Promise<CreateWorkReportResponse> {
  return apiFetch<CreateWorkReportResponse>("/work-reports", {
    method: "POST",
    auth: "required",
    body: JSON.stringify(body),
  }).catch(
    (err: Error & { body?: CreateWorkReportResponse; status?: number }) => {
      if (err.body && typeof err.body === "object" && "ok" in err.body) {
        return err.body;
      }
      throw err;
    },
  );
}

export function fetchPendingVerifications(): Promise<PendingVerificationsPage> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch(`/verifications/pending?${params}`, { auth: "required" });
}

export function fetchPendingCommentNotices(): Promise<PendingCommentNoticesPage> {
  return apiFetch(`/comment-notices/pending`, { auth: "required" });
}

export function fetchWorkReportDetail(
  workReportNid: string,
): Promise<WorkReportDetail> {
  const params = new URLSearchParams({ lang: getLocale() });
  return apiFetch(
    `/work-reports/${encodeURIComponent(workReportNid)}?${params}`,
    { auth: "required" },
  );
}

export function submitVerification(
  slotNid: string,
  body: SubmitVerificationBody,
): Promise<SubmitVerificationResponse> {
  return apiFetch<SubmitVerificationResponse>(
    `/verifications/${encodeURIComponent(slotNid)}`,
    {
      method: "POST",
      auth: "required",
      body: JSON.stringify(body),
    },
  ).catch(
    (err: Error & { body?: SubmitVerificationResponse; status?: number }) => {
      if (err.body && typeof err.body === "object" && "ok" in err.body) {
        return err.body;
      }
      throw err;
    },
  );
}

export function registerPushToken(body: {
  expo_push_token: string;
  platform: "ios" | "android";
}): Promise<{ ok: true }> {
  return apiFetch("/push-tokens", {
    method: "POST",
    auth: "required",
    body: JSON.stringify(body),
  });
}

export function unregisterPushToken(body?: {
  expo_push_token?: string;
}): Promise<{ ok: true }> {
  return apiFetch("/push-tokens", {
    method: "DELETE",
    auth: "required",
    body: JSON.stringify(body ?? {}),
  });
}
