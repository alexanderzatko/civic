import Constants from "expo-constants";
import type {
  CharityProject,
  ContributionsSummary,
  RankDistribution,
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
  client_id: string;
  scope: string | null;
  expires_at: number;
};

export type MyContributionsSummary = ContributionsSummary & {
  rovas_uid: string;
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
    body: JSON.stringify({ qr_or_uid: qrOrUid }),
  }).catch((err: Error & { body?: VerifyReceiptResponse }) => {
    if (err.body) return err.body;
    throw err;
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

export function fetchProjects(
  type: "charity" | "invest",
): Promise<{ projects: CharityProject[] }> {
  return apiFetch(`/charities/projects?type=${type}`);
}
