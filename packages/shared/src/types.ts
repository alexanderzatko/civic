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

export interface VerifiedReceiptPreview {
  receipt_uid: string;
  verified: true;
  merchant_name: string | null;
  purchase_at: string | null;
  total_price_eur: number | null;
  vat_eur: number;
  merits_preview: number;
  hourly_wage_eur: number;
  formula_version: number;
  wage_basis: "net" | "gross";
  /** True when Rovas {civic_claims} already has this UID (signed-in verify). */
  already_claimed?: boolean;
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
  id: string;
  title: string;
  organization: string;
  summary: string;
  rovas_url: string;
  type: "charity" | "invest";
  currency_amount_collected?: number;
  expected_yield_me_per_year?: number;
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
