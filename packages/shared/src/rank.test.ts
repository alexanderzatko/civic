import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bucketIndexForMe,
  bucketIndexFromSlider,
  medianBucketIndex,
  meFromPercentile,
  meFromSliderPosition,
  percentileFromDistribution,
  sliderPositionFromMe,
  spelledBucketLabel,
} from "./rank.js";
import type { RankDistribution } from "./types.js";

describe("percentileFromDistribution", () => {
  const dist: RankDistribution = {
    buckets: [
      { label: "0–1", count: 10 },
      { label: "1–10", count: 20 },
      { label: "10–100", count: 70 },
    ],
    bin_edges_log10: [0, 1, 2, 3],
    total_users: 100,
  };

  it("returns low percentile for small balances", () => {
    const p = percentileFromDistribution(dist, 0.5);
    assert.ok(p !== null && p < 15);
  });

  it("returns high percentile for large balances", () => {
    // edges [0,1,2,3] → bands 1–10, 10–100, 100–1000; 500 sits in the last band
    const p = percentileFromDistribution(dist, 500);
    assert.ok(p !== null && p > 40);
  });

  it("falls back to bucket midpoint without edges", () => {
    const noEdges: RankDistribution = {
      buckets: dist.buckets,
      total_users: 100,
      user_bucket_index: 1,
    };
    const p = percentileFromDistribution(noEdges, 5);
    assert.equal(p, ((10 + 20 * 0.5) / 100) * 100);
  });

  it("ignores inflated total_users so the runner matches the histogram", () => {
    // Rovas total_users includes zero-ME accounts excluded from buckets.
    const inflated: RankDistribution = {
      ...dist,
      total_users: 10_000,
    };
    const p = percentileFromDistribution(inflated, 500);
    // Among the 100 binned users, 500 ME is in the top band → high percentile.
    assert.ok(p !== null && p > 40);
    // Must not be diluted by the 10k total (~3%).
    assert.ok(p! > 10);
  });

  it("round-trips percentile ↔ ME roughly", () => {
    const p = percentileFromDistribution(dist, 50);
    assert.ok(p !== null);
    const back = meFromPercentile(dist, p!);
    assert.ok(back !== null);
    assert.ok(Math.abs(Math.log10(back!) - Math.log10(50)) < 0.15);
  });

  it("maps ME to bucket index", () => {
    assert.equal(bucketIndexForMe(dist, 5), 0);
    assert.equal(bucketIndexForMe(dist, 50), 1);
    assert.equal(bucketIndexForMe(dist, 500), 2);
  });

  it("picks the people-weighted median bucket", () => {
    // counts 10 / 20 / 70 → median lands in the last band
    assert.equal(medianBucketIndex(dist), 2);
    const even: RankDistribution = {
      buckets: [
        { label: "a", count: 5 },
        { label: "b", count: 5 },
        { label: "c", count: 5 },
        { label: "d", count: 5 },
      ],
      bin_edges_log10: [0, 1, 2, 3, 4],
      total_users: 20,
    };
    // cumulative crosses half (10) at index 1
    assert.equal(medianBucketIndex(even), 1);
  });
});

describe("equal-width slider mapping", () => {
  const dist: RankDistribution = {
    buckets: [
      { label: "0–1", count: 10 },
      { label: "1–10", count: 20 },
      { label: "10–100", count: 70 },
    ],
    bin_edges_log10: [0, 1, 2, 3],
    total_users: 100,
  };

  it("places band boundaries at equal slider fractions", () => {
    // Mid of band 0 → ~16.7%; mid of band 1 → ~50%; mid of band 2 → ~83.3%
    const mid0 = sliderPositionFromMe(dist, Math.pow(10, 0.5))!;
    const mid1 = sliderPositionFromMe(dist, Math.pow(10, 1.5))!;
    const mid2 = sliderPositionFromMe(dist, Math.pow(10, 2.5))!;
    assert.ok(Math.abs(mid0 - 100 / 6) < 0.01);
    assert.ok(Math.abs(mid1 - 50) < 0.01);
    assert.ok(Math.abs(mid2 - 500 / 6) < 0.01);
  });

  it("maps equal slider slices to consecutive bands", () => {
    assert.equal(bucketIndexFromSlider(dist, 0), 0);
    assert.equal(bucketIndexFromSlider(dist, 33), 0);
    assert.equal(bucketIndexFromSlider(dist, 34), 1);
    assert.equal(bucketIndexFromSlider(dist, 66), 1);
    assert.equal(bucketIndexFromSlider(dist, 67), 2);
    assert.equal(bucketIndexFromSlider(dist, 100), 2);
  });

  it("round-trips slider position ↔ ME on the geometric scale", () => {
    const pos = sliderPositionFromMe(dist, 50)!;
    const back = meFromSliderPosition(dist, pos)!;
    assert.ok(Math.abs(Math.log10(back) - Math.log10(50)) < 0.05);
  });
});

describe("spelledBucketLabel", () => {
  const decade: RankDistribution = {
    buckets: [
      { label: "0–1", count: 10 },
      { label: "1–10", count: 20 },
      { label: "10–100", count: 70 },
    ],
    // Sentinel for linear 0, then log10 decades.
    bin_edges_log10: [-30, 0, 1, 2],
    total_users: 100,
  };

  it("formats decade bands with a zero lower bound", () => {
    assert.equal(spelledBucketLabel(decade, 0, "en-US"), "0 – 1 Merits");
    assert.equal(spelledBucketLabel(decade, 1, "en-US"), "1 – 10 Merits");
    assert.equal(spelledBucketLabel(decade, 2, "en-US"), "10+ Merits");
  });
});
