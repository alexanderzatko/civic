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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

export function fetchMySummary(): Promise<ContributionsSummary> {
  return apiFetch("/me/contributions/summary");
}

export function fetchCommunitySummary(): Promise<ContributionsSummary> {
  return apiFetch("/community/contributions/summary");
}

export function fetchRankDistribution(): Promise<RankDistribution> {
  return apiFetch("/rank/distribution");
}

export function fetchProjects(
  type: "charity" | "invest",
): Promise<{ projects: CharityProject[] }> {
  return apiFetch(`/charities/projects?type=${type}`);
}
