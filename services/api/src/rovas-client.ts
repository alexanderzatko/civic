import type { ContributionCategoryBreakdown, RankDistribution } from "@civic/shared";

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
    readonly status: 401 | 404 | 502 | 503 = 502,
  ) {
    super(message);
    this.name = "RovasClientError";
  }
}

/**
 * Thin HTTP client for Civic home-read APIs on Rovas
 * (`/rovas/me`, `/rovas/contributions/aggregate`, `/rovas/merit_distribution`).
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

  private async getJson<T>(
    path: string,
    accessToken?: string,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { headers });
    } catch {
      throw new RovasClientError(`Rovas unreachable (${path})`, 503);
    }

    if (res.status === 401) {
      throw new RovasClientError(`Rovas unauthorized (${path})`, 401);
    }
    if (res.status === 404) {
      throw new RovasClientError(`Rovas not found (${path})`, 404);
    }
    if (!res.ok) {
      throw new RovasClientError(
        `Rovas ${path} failed (${res.status})`,
        res.status >= 500 ? 503 : 502,
      );
    }

    return (await res.json()) as T;
  }
}

function normalizeCategories(
  raw: Partial<ContributionCategoryBreakdown> | undefined,
): ContributionCategoryBreakdown {
  return {
    taxes: Number(raw?.taxes) || 0,
    charity: Number(raw?.charity) || 0,
    volunteer: Number(raw?.volunteer) || 0,
  };
}
