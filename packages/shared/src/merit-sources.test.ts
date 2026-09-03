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

  it("folds penalty into volunteer (may go negative)", () => {
    assert.deepEqual(
      categoriesFromMeritSources({
        volunteer_work: 50,
        penalty: -80,
        tax_payment: 100,
      }),
      { taxes: 100, charity: 0, volunteer: -30 },
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
      { taxes: 9, charity: 0, volunteer: -1 },
    );
  });

  it("falls back to by_category when by_source is absent", () => {
    assert.deepEqual(
      resolveContributionCategories({ taxes: 5, charity: 6, volunteer: 7 }),
      { taxes: 5, charity: 6, volunteer: 7 },
    );
  });
});
