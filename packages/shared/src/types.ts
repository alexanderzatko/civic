/** Shared API / domain types for Civic v1. */

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy_m?: number;
}

export interface ClaimShareInput {
  rovas_uid: string;
  share_pct: number;
}

/** Public profile row from `GET /users/search` (split-claim typeahead). */
export interface UserSearchResult {
  rovas_uid: string;
  username: string;
  display_name: string;
}

/** Named contribution row on a public profile (charity / volunteer). */
export interface UserLookupProjectRow {
  /** Drupal project nid when Rovas includes it (additive). */
  project_nid?: string;
  name: string;
  me: number;
}

/** Work-report row inside a Civic project detail / WR page. */
export interface ProjectWorkReportItem {
  work_report_nid: string;
  title: string;
  summary: string | null;
  hours: number | null;
  author_username: string | null;
  author_display_name: string | null;
  created_at: string | null;
  /** Absolute image URLs from `field_photos` (empty if none / private). */
  photo_urls: string[];
}

/** Paginated work reports for a project. */
export interface ProjectWorkReportPage {
  project_nid: string;
  total: number;
  limit: number;
  offset: number;
  items: ProjectWorkReportItem[];
}

/**
 * Project shareholder row.
 * `share_kind = percent` → fixed Merit allocation %;
 * `share_kind = time_based` → share tracks work time (`hours`).
 */
export interface ProjectShareholderItem {
  username: string;
  share_kind: "percent" | "time_based";
  /** Present when `share_kind === "percent"`. */
  share_percent: number | null;
  /** Hours attributed (especially for time-based shares). */
  hours: number | null;
}

/** Paginated shareholders for a project. */
export interface ProjectShareholderPage {
  project_nid: string;
  total: number;
  limit: number;
  offset: number;
  items: ProjectShareholderItem[];
}

/**
 * Project detail for the in-app modal
 * (`GET /projects/:nid` → Rovas `GET /rovas/civic_project/{nid}`).
 */
export interface ProjectDetail {
  project_nid: string;
  title: string;
  summary: string | null;
  /**
   * Reflects Rovas `field_participation` (Public vs owner-managed joining).
   * Does **not** hide project content — private projects are still fully readable.
   */
  is_public: boolean;
  owner_username: string | null;
  owner_display_name: string | null;
  total_hours: number | null;
  total_me: number | null;
  work_report_count: number;
  shareholder_count: number;
  rovas_url: string;
  work_reports: ProjectWorkReportPage;
  /** First page of shareholders when public; empty page when private/unavailable. */
  shareholders: ProjectShareholderPage;
  /** True when the Rovas project has the charitable checkbox set. */
  is_charity?: boolean;
  /** NeoFund approval state when `is_charity`; omit/`null` otherwise. */
  charity_status?: "approved" | "pending" | null;
  /** Org legal name for charity projects. */
  organization?: string | null;
  /** How to donate (plain text); shown in Civic for approved charities. */
  donate_instructions?: string | null;
  /** Optional off-app donate URL (opens in the device browser). */
  donate_url?: string | null;
}

/** Month bucket for tax Merits on a public profile (`YYYY-MM`). */
export interface UserLookupTaxMonth {
  month: string;
  me: number;
}

/**
 * Top-level NACE section expertise row from `users_lookup.nace_expertise`
 * (Merit Index icons on Rovas web).
 */
export interface NaceExpertiseSection {
  section_tid: number;
  section_label: string;
  section_letter: string;
  icon_url: string;
  me: number;
  share_percent: number;
  hourly_rate_eur: number;
}

/**
 * Signed-in identity from `GET /me` (proxies Rovas `GET /rovas/me`).
 */
export interface MeProfile {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  total_me?: number;
  /** Chron wallet when Rovas exposes `total_chr` on `/rovas/me`. */
  total_chr?: number;
  language?: string | null;
  client_id: string;
  scope: string | null;
  expires_at: number;
}

/**
 * Public contribution profile from `GET /users/lookup?username=`
 * (proxies Rovas `GET /rovas/users_lookup?username=`).
 * Percentile / rank ladder are computed on Civic from `/rank/distribution`.
 *
 * `by_category` is Civic’s taxes/charity/volunteer mix. When Rovas sends
 * `by_source`, the API remaps it (penalty → volunteer) before returning.
 */
export interface UserLookup {
  rovas_uid: string;
  username: string;
  display_name: string;
  total_me: number;
  /** Year the Rovas account was created (0 when not returned by Rovas). */
  member_since_year: number;
  by_category: ContributionCategoryBreakdown;
  /** NACE section expertise icons (Merit Index); empty when none. */
  nace_expertise: NaceExpertiseSection[];
  /** Last ≤3 calendar months of VAT-claim Merits; empty if none. */
  taxes_last_3_months: UserLookupTaxMonth[];
  /** Top ≤3 charity orgs by ME; empty if unavailable. */
  top_charities: UserLookupProjectRow[];
  /** Top ≤3 volunteer projects by ME; empty if unavailable. */
  top_volunteer_projects: UserLookupProjectRow[];
}

export interface VerifiedReceiptPreview {
  receipt_uid: string;
  verified: true;
  merchant_name: string | null;
  /** Store / merchant address used for same-store fraud key (when available). */
  store_address?: string | null;
  purchase_at: string | null;
  total_price_eur: number | null;
  vat_eur: number;
  merits_preview: number;
  hourly_wage_eur: number;
  formula_version: number;
  wage_basis: "net" | "gross";
  /** True when Rovas {civic_claims} already has this UID (signed-in verify). */
  already_claimed?: boolean;
  /**
   * Soft fraud gate for signed-in verify. Scan/preview still succeeds;
   * Claim should be disabled when false.
   */
  claim_allowed?: boolean;
  claim_block?: {
    code: ClaimReceiptErrorCode;
    message: string;
  };
}

export interface VerifyReceiptError {
  verified: false;
  receipt_uid: string | null;
  code:
    | "invalid_uid"
    | "not_found"
    | "fs_error"
    | "offline_unsupported";
  message: string;
}

export type VerifyReceiptResponse = VerifiedReceiptPreview | VerifyReceiptError;

export type ClaimReceiptErrorCode =
  | "unauthorized"
  | "invalid_uid"
  | "not_found"
  | "fs_error"
  | "offline_unsupported"
  | "duplicate"
  | "rejected_location"
  | "rejected_window"
  | "rejected_rate"
  | "rejected_vat"
  | "rejected_shares"
  | "rejected_strikes"
  | "rejected_account_age"
  | "rejected_same_store"
  | "rovas_error";

export interface ClaimShareResult {
  beneficiary_rovas_uid: string;
  share_pct: number;
  merits_awarded: number;
}

export interface ClaimReceiptSuccess {
  claimed: true;
  receipt_uid: string;
  total_merits: number;
  vat_eur: number;
  merchant_name: string | null;
  shares: ClaimShareResult[];
}

export interface ClaimReceiptError {
  claimed: false;
  receipt_uid: string | null;
  code: ClaimReceiptErrorCode;
  message: string;
}

export type ClaimReceiptResponse = ClaimReceiptSuccess | ClaimReceiptError;

export interface ContributionCategoryBreakdown {
  taxes: number;
  charity: number;
  volunteer: number;
}

export interface ContributionsSummary {
  total_me: number;
  by_category: ContributionCategoryBreakdown;
  receipt_count?: number;
  total_vat_eur?: number;
}

export interface CharityProject {
  /** Stable row key — `project_nid` for live charity rows; stub id for invest. */
  id: string;
  /** Rovas project nid when known (live charity catalog). */
  project_nid?: string;
  title: string;
  organization: string;
  summary: string;
  rovas_url: string;
  type: "charity" | "invest";
  /** Project Merit total (`field_merit_reward`); used for popularity sort. */
  total_me?: number;
  currency_amount_collected?: number;
  expected_yield_me_per_year?: number;
}

/** Envelope for `GET /charities/projects`. */
export interface CharityProjectsResponse {
  projects: CharityProject[];
  /**
   * Count of all approved charitable projects (ignores limit/query).
   * Civic hides search when `total < 6`. For invest stubs equals `projects.length`.
   */
  total: number;
}

export interface RankBucket {
  label: string;
  count: number;
}

export interface RankDistribution {
  buckets: RankBucket[];
  user_bucket_index?: number;
  username?: string;
  /** Present when the request carried a valid Bearer token. */
  user_merits?: number;
  total_users?: number;
  /** Log10 bin edges from Rovas Merit Distribution (length = buckets + 1). */
  bin_edges_log10?: number[];
}

export type MeritIndexSort =
  | "position"
  | "total_me"
  | "value_eur"
  | "member_since"
  | "country"
  | "taxes_me"
  | "charity_me"
  | "volunteer_me";

export type MeritIndexOrder = "asc" | "desc";

export type MeritSourceCategory = "taxes" | "charity" | "volunteer";

/** Country with Merit Index users (`GET /rank/index/countries`). */
export interface MeritIndexCountry {
  iso2: string;
  label: string;
  user_count: number;
}

/** Query params for `GET /rank/index` → Rovas `civic_merit_index`. */
export interface MeritIndexFilters {
  limit?: number;
  offset?: number;
  sort?: MeritIndexSort;
  order?: MeritIndexOrder;
  country_iso2?: string;
  since_from?: string;
  min_me?: number;
  max_me?: number;
  min_value_eur?: number;
  max_value_eur?: number;
  nace_section_tid?: number;
  source_category?: MeritSourceCategory;
  lang?: string;
}

/** One row of the Merit Index / Prínos leaderboard. */
export interface MeritIndexRow {
  position: number;
  rovas_uid: string;
  username: string;
  display_name: string;
  member_since_year: number;
  total_me: number;
  value_eur: number;
  country_iso2: string | null;
  country_label: string | null;
  /**
   * Civic ME-source mix. When Rovas includes `by_source`, Civic remaps it
   * (penalty → volunteer) into these buckets.
   */
  by_category: ContributionCategoryBreakdown;
  nace_expertise: NaceExpertiseSection[];
}

/** Paginated Merit Index from `GET /rank/index`. */
export interface MeritIndexPage {
  total: number;
  limit: number;
  offset: number;
  sort: MeritIndexSort;
  order: MeritIndexOrder;
  items: MeritIndexRow[];
}

/** Civic `GET /merit-rate` — Rovas national wage with local fallback. */
export interface MeritRate {
  country_code: string;
  hourly_wage_eur: number;
  merits_per_hour: number;
  wage_basis: "net" | "gross";
  formula_version: number;
  source: "rovas" | "fallback";
  rovas_source?: string;
  updated?: string | null;
}

/** History tab for `GET /receipts?view=` (proxies Rovas civic_claims). */
export type ReceiptHistoryView = "submitted" | "received";

export interface ReceiptHistoryShare {
  beneficiary_rovas_uid: string;
  share_pct: number;
  merits_awarded: number;
}

/** Claim the caller scanned (`view=submitted`). */
export interface ReceiptSubmittedItem {
  receipt_uid: string;
  vat_eur: number;
  total_merits_awarded: number;
  merchant_name: string | null;
  purchase_at: string | null;
  created_at: string;
  shares: ReceiptHistoryShare[];
}

/** Share credited to the caller (`view=received`). */
export interface ReceiptReceivedItem {
  receipt_uid: string;
  merchant_name: string | null;
  purchase_at: string | null;
  scanner_rovas_uid: string;
  /** Present after Rovas enrich-received task; optional for older responses. */
  scanner_username?: string;
  scanner_display_name?: string;
  share_pct: number;
  merits_awarded: number;
  created_at: string;
}

export interface ReceiptHistoryPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  view: ReceiptHistoryView;
}

export type ReceiptSubmittedHistory = ReceiptHistoryPage<ReceiptSubmittedItem>;
export type ReceiptReceivedHistory = ReceiptHistoryPage<ReceiptReceivedItem>;

/** Received-based taxes stats from `GET /rovas/civic_claims/summary`. */
export interface ReceiptClaimsSummary {
  receipt_count: number;
  total_vat_eur: number;
  taxes_me: number;
}

/** Line item from Finančná správa receipt/find (history detail modal). */
export interface ReceiptDetailItem {
  name: string;
  quantity: number;
  /** Line total in EUR (FS `price`; can be negative for returns/discounts). */
  price_eur: number;
  vat_rate: number;
  item_type: string | null;
}

export interface ReceiptVatBreakdownRow {
  vat_rate: number;
  vat_base_eur: number;
  vat_amount_eur: number;
}

/** Full FS receipt detail for history tap-through. */
export interface ReceiptDetail {
  receipt_uid: string;
  found: true;
  merchant_name: string | null;
  merchant_address: string | null;
  store_name: string | null;
  store_address: string | null;
  purchase_at: string | null;
  /** Original FS wall-clock string, e.g. `28.06.2022 11:37:35`. */
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
  items: ReceiptDetailItem[];
  vat_summary: ReceiptVatBreakdownRow[];
}

export interface ReceiptDetailError {
  found: false;
  receipt_uid: string | null;
  code: "invalid_uid" | "not_found" | "fs_error";
  message: string;
}

export type ReceiptDetailResponse = ReceiptDetail | ReceiptDetailError;

/** Source kind from Rovas Views `merit_history` Source PHP field. */
export type MeritHistorySourceKind = "project" | "report" | "purchase";

/** One row of the signed-in user's Merit ledger (`GET /users/me/merit-history`). */
export interface MeritHistoryItem {
  disbursement_nid: string;
  node_type: "merits_disbursement" | "merit_penalty";
  created_at: string;
  merits: number;
  source_kind: MeritHistorySourceKind;
  /** Localized project or work-report title; null for `purchase`. */
  source_title: string | null;
  project_nid: string | null;
  work_report_nid: string | null;
}

export interface MeritHistoryPage {
  items: MeritHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Project row for volunteer picker (`GET /projects/mine`, `/projects/search`). */
export interface VolunteerProjectRow {
  project_nid: string;
  title: string;
  is_public: boolean;
  /** Whether the signed-in user may submit a work report (owner/shareholder/public). */
  can_report: boolean;
}

/** Nested NACE taxonomy node (`GET /nace`). */
export interface NaceNode {
  tid: string;
  code: string;
  label: string;
  children: NaceNode[];
}

export type AiNaceStatus = "ok" | "need_more_info" | "unavailable" | "error";

/** Request body for `POST /nace/classify` (proxies Rovas civic_ai_nace). */
export interface ClassifyNaceBody {
  description: string;
  project_nid?: string;
  lang?: "sk" | "en";
}

/** Response from AI NACE classification. */
export interface ClassifyNaceResponse {
  status: AiNaceStatus;
  nace_tid: string;
  nace_code: string;
  nace_label: string;
  title: string;
  clarifying_question: string;
  confidence: number;
  error: string;
}

export type RewardKind = "merits" | "chrons";

export type WorkReportGeometryType = "Point" | "LineString" | "Polygon";

/** GeoJSON geometry for work-report map proof (RFC 7946, lon/lat order). */
export type WorkReportGeoJsonGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] };

export interface WorkReportMapRasterLayer {
  id: string;
  name: string;
  /** XYZ tile URL with `{z}`, `{x}`, `{y}` placeholders. */
  url_template: string;
  attribution?: string;
  max_zoom?: number;
}

export interface WorkReportMapConfig {
  center: { latitude: number; longitude: number };
  zoom: number;
  geometry_types: WorkReportGeometryType[];
  raster_layers: WorkReportMapRasterLayer[];
  default_layer_id?: string;
}

export interface WorkReportPhotoInput {
  filename: string;
  mime: string;
  data: string;
}

export interface CreateProjectBody {
  name: string;
  description: string;
  url?: string;
}

export interface CreateProjectSuccess {
  ok: true;
  project_nid: string;
}

export interface CreateProjectError {
  ok: false;
  error: "invalid_input" | "unauthorized" | "rovas_error";
  message: string;
}

export type CreateProjectResponse = CreateProjectSuccess | CreateProjectError;

export interface CreateWorkReportBody {
  project_nid: string;
  date_started: number;
  hours: number;
  description: string;
  title?: string;
  nace_tid: string;
  web_url?: string;
  reward_kind?: RewardKind;
  photos?: WorkReportPhotoInput[];
  field_location?: WorkReportGeoJsonGeometry;
  /** Set by Civic API from env — not chosen by the mobile client. */
  usage_fee_project_id?: number;
  /** Fraction in (0, 1]; set by Civic API from env. */
  usage_fee_rate?: number;
}

/** Civic API `GET /work-reports/fee-info` — form disclosure (no Rovas call). */
export interface WorkReportFeeInfo {
  enabled: boolean;
  wr_usage_fee_rate: number;
  rovas_platform_fee_rate: number;
}

export type CreateWorkReportErrorCode =
  | "not_shareholder"
  | "date_before_registration"
  | "pending_verifications"
  | "invalid_input"
  | "project_not_found"
  | "unauthorized"
  | "rovas_error";

export interface CreateWorkReportSuccess {
  ok: true;
  work_report_nid: string;
  reward_kind: RewardKind;
}

export interface CreateWorkReportError {
  ok: false;
  error: CreateWorkReportErrorCode;
  message: string;
}

export type CreateWorkReportResponse =
  | CreateWorkReportSuccess
  | CreateWorkReportError;

/** Verification slot row for Civic in-app notifications. */
export interface PendingVerificationItem {
  slot_nid: string;
  work_report_nid: string;
  title: string;
  author_username: string | null;
  author_display_name: string | null;
  project_nid: string | null;
  assigned_at: string | null;
}

export interface PendingVerificationsPage {
  total: number;
  items: PendingVerificationItem[];
}

export interface WorkReportVerificationContext {
  slot_nid: string;
  can_decline: boolean;
  verification_count: number;
  verification_needed: number;
}

/** Full work report for verify screen (extends project ledger row). */
export interface WorkReportDetail extends ProjectWorkReportItem {
  project_nid?: string | null;
  project_name?: string | null;
  web_urls?: string[];
  field_location?: WorkReportGeoJsonGeometry | null;
  nace_tid?: string | null;
  nace_label?: string | null;
  reward_kind?: RewardKind;
  date_started?: number | null;
  verification?: WorkReportVerificationContext;
}

export type VerificationVerdict = "approve" | "reject" | "decline";

export interface SubmitVerificationBody {
  verdict: VerificationVerdict;
  verified_hours?: number;
  note?: string;
}

export type SubmitVerificationErrorCode =
  | "not_assigned"
  | "already_verified"
  | "not_verifiable"
  | "cannot_decline"
  | "invalid_input"
  | "not_found"
  | "unauthorized"
  | "rovas_error";

export interface SubmitVerificationSuccess {
  ok: true;
  verification_nid?: string;
  work_report_nid: string;
  verdict: VerificationVerdict;
}

export interface SubmitVerificationError {
  ok: false;
  error: SubmitVerificationErrorCode;
  message: string;
}

export type SubmitVerificationResponse =
  | SubmitVerificationSuccess
  | SubmitVerificationError;
