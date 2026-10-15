import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoriesFromMeritSources,
  resolveContributionCategories,
} from "./merit-sources.js";

describe("categoriesFromMeritSources", () => {
  it("maps tax / charity / volunteer sources into Civic buckets", () => {
    assert.deepEqual(
      categoriesFromMeritSources({
        tax_payment: 980,
        charitable_donation: 210,
        volunteer_work: 120,
        volunteer: 28,
      }),
      { taxes: 980, charity: 210, volunteer: 148 },
    );
  });

  it("splits penalty across non-zero buckets proportionally", () => {
    // bases 100 + 50 = 150; penalty -80 → taxes −80×100/150, volunteer −80×50/150
    assert.deepEqual(
      categoriesFromMeritSources({
        volunteer_work: 50,
        penalty: -80,
        tax_payment: 100,
      }),
      { taxes: 46.67, charity: 0, volunteer: 23.33 },
    );
  });

  it("splits penalty across charity and volunteer (LAO-shaped)", () => {
    // 8.93 + 7.53 = 16.46; −10 × shares
    assert.deepEqual(
      categoriesFromMeritSources({
        charitable_donation: 8.93,
        volunteer_work: 7.53,
        penalty: -10,
      }),
      { taxes: 0, charity: 3.5, volunteer: 2.96 },
    );
  });

  it("assigns all penalty to the sole non-zero bucket", () => {
    assert.deepEqual(
      categoriesFromMeritSources({
        tax_payment: 9,
        penalty: -1,
      }),
      { taxes: 8, charity: 0, volunteer: 0 },
    );
  });

  it("splits penalty equally when all earned buckets are zero", () => {
    assert.deepEqual(
      categoriesFromMeritSources({
        penalty: -3,
      }),
      { taxes: -1, charity: -1, volunteer: -1 },
    );
  });

  it("returns null for missing or empty source maps", () => {
    assert.equal(categoriesFromMeritSources(undefined), null);
    assert.equal(categoriesFromMeritSources(null), null);
    assert.equal(categoriesFromMeritSources({}), null);
  });

  it("ignores unknown / legacy source keys", () => {
    assert.deepEqual(
      categoriesFromMeritSources({ legacy: 40, tax_payment: 10 }),
      { taxes: 10, charity: 0, volunteer: 0 },
    );
  });
});

describe("resolveContributionCategories", () => {
  it("prefers by_source over by_category", () => {
    assert.deepEqual(
      resolveContributionCategories(
        { taxes: 1, charity: 2, volunteer: 3 },
        { tax_payment: 9, penalty: -1 },
      ),
      { taxes: 8, charity: 0, volunteer: 0 },
    );
  });

  it("falls back to by_category when by_source is absent", () => {
    assert.deepEqual(
      resolveContributionCategories({ taxes: 5, charity: 6, volunteer: 7 }),
      { taxes: 5, charity: 6, volunteer: 7 },
    );
  });
});
