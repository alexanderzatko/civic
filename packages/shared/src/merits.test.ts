import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeMerits, displayMerits, splitMerits } from "./merits.js";
import { parseReceiptUid, normalizeUid } from "./receipt-uid.js";

describe("parseReceiptUid", () => {
  it("accepts bare UID", () => {
    assert.equal(
      parseReceiptUid("O-7AF0CFF74D45483FB0CFF74D45283FA1"),
      "O-7AF0CFF74D45483FB0CFF74D45283FA1",
    );
  });

  it("extracts UID from URL", () => {
    assert.equal(
      parseReceiptUid(
        "https://opd.financnasprava.sk/#!/receipt/O-7af0cff74d45483fb0cff74d45283fa1",
      ),
      "O-7AF0CFF74D45483FB0CFF74D45283FA1",
    );
  });

  it("rejects garbage", () => {
    assert.equal(parseReceiptUid("not-a-receipt"), null);
  });

  it("normalizes thermal-print 0- prefix to O-", () => {
    assert.equal(
      parseReceiptUid("0-3C5EDB38C1E24F189EDB38C1E23F18F9"),
      "O-3C5EDB38C1E24F189EDB38C1E23F18F9",
    );
  });
});

describe("normalizeUid", () => {
  it("uppercases hex", () => {
    assert.equal(
      normalizeUid("o-7af0cff74d45483fb0cff74d45283fa1"),
      "O-7AF0CFF74D45483FB0CFF74D45283FA1",
    );
  });
});

describe("computeMerits", () => {
  it("converts VAT at net wage", () => {
    // 1.25 EUR VAT / 7.5 €/h * 10 ME/h = 1.666... → 1.67
    assert.equal(computeMerits({ vatEur: 1.25, hourlyWageEur: 7.5 }), 1.67);
  });
});

describe("splitMerits", () => {
  it("assigns residue to scanner", () => {
    const rows = splitMerits({
      totalMerits: 1.67,
      scannerRovasUid: "scanner",
      shares: [
        { rovasUid: "scanner", sharePct: 50 },
        { rovasUid: "other", sharePct: 50 },
      ],
    });
    const sum = rows.reduce((s, r) => s + r.meritsAwarded, 0);
    assert.equal(sum, 1.67);
    assert.ok(rows.find((r) => r.rovasUid === "scanner")!.roundingResidue >= 0);
  });
});

describe("displayMerits", () => {
  it("rounds to whole numbers for UI", () => {
    assert.equal(displayMerits(1.67), 2);
    assert.equal(displayMerits(1.4), 1);
  });
});
