import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactIbanOrNull, isPlausibleIban, normalizeIban } from "./iban.js";

describe("iban helpers", () => {
  it("normalizes spaces and case", () => {
    assert.equal(
      normalizeIban("sk96 1100 0000 0029 1859 9669"),
      "SK9611000000002918599669",
    );
  });

  it("accepts plausible compact IBANs", () => {
    assert.equal(isPlausibleIban("SK9611000000002918599669"), true);
    assert.equal(
      compactIbanOrNull(" SK9611000000002918599669 "),
      "SK9611000000002918599669",
    );
  });

  it("rejects junk", () => {
    assert.equal(isPlausibleIban("not-an-iban"), false);
    assert.equal(compactIbanOrNull(""), null);
    assert.equal(compactIbanOrNull(null), null);
    assert.equal(compactIbanOrNull(12), null);
  });
});
