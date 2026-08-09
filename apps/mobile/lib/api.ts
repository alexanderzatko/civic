import Constants from "expo-constants";
import type {
  CharityProject,
  ClaimReceiptResponse,
  ClaimShareInput,
  ContributionsSummary,
  GeoLocation,
  MeritRate,
  RankDistribution,
  ReceiptDetailResponse,
  ReceiptHistoryView,
  ReceiptReceivedHistory,
  ReceiptSubmittedHistory,
  UserSearchResult,
  VerifyReceiptResponse,
} from "@civic/shared";

const fallbackUrl = "http://localhost:3001";

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    fallbackUrl
  );
}

export type MeIdentity = {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  total_me?: number;
  client_id: string;
  scope: string | null;
  expires_at: number;
};

export type MyContributionsSummary = ContributionsSummary & {
  rovas_uid: string;
  username?: string;
  display_name?: string;
  scope?: string;
};

type TokenGetter = () => Promise<string | null>;

let getAccessToken: TokenGetter | null = null;

/** Register the auth-session token provider (called from AuthProvider). */
export function setAccessTokenGetter(getter: TokenGetter | null): void {
  getAccessToken = getter;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: "required" | "optional" | false },
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

  const { auth: _auth, ...rest } = init ?? {};
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers,
  });
  const body = (await res.json()) as T;
  if (!res.ok) {
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
  location: GeoLocation,
  shares?: ClaimShareInput[],
): Promise<ClaimReceiptResponse> {
  return apiFetch<ClaimReceiptResponse>("/receipts/claim", {
    method: "POST",
    auth: "required",
    body: JSON.stringify({
      qr_or_uid: qrOrUid,
      location,
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

export function fetchMe(): Promise<MeIdentity> {
  return apiFetch("/me", { auth: "required" });
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
): Promise<{ projects: CharityProject[] }> {
  return apiFetch(`/charities/projects?type=${type}`);
}
