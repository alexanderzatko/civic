import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMerits,
  displayMerits,
  formatMeritsCompact,
  formatMeritsCompactLabel,
  splitMerits,
} from "./merits.js";
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

  it("burns anonymous share and does not fold residue into scanner", () => {
    const rows = splitMerits({
      totalMerits: 10,
      scannerRovasUid: "scanner",
      shares: [
        { rovasUid: "scanner", sharePct: 70 },
        { rovasUid: "anonymous", sharePct: 30 },
      ],
    });
    const anon = rows.find((r) => r.rovasUid === "anonymous")!;
    const scanner = rows.find((r) => r.rovasUid === "scanner")!;
    assert.equal(anon.meritsAwarded, 0);
    assert.equal(scanner.meritsAwarded, 7);
    const sum = rows.reduce((s, r) => s + r.meritsAwarded, 0);
    assert.equal(sum, 7);
  });
});

describe("displayMerits", () => {
  it("rounds to whole numbers for UI", () => {
    assert.equal(displayMerits(1.67), 2);
    assert.equal(displayMerits(1.4), 1);
  });
});

describe("formatMeritsCompact", () => {
  it("keeps decimals for ≥ 1 ME", () => {
    assert.deepEqual(formatMeritsCompact(1.67, "en-US"), {
      coefficient: "1.67",
      prefix: "",
    });
    assert.equal(formatMeritsCompactLabel(1.4, "en-US"), "1.4");
  });

  it("uses milli for sub-ME grants", () => {
    assert.deepEqual(formatMeritsCompact(0.42, "en-US"), {
      coefficient: "420",
      prefix: "m",
    });
    assert.equal(formatMeritsCompactLabel(0.0015, "en-US"), "1.5 m");
  });

  it("uses micro / nano / pico for tinier amounts", () => {
    assert.deepEqual(formatMeritsCompact(5e-6, "en-US"), {
      coefficient: "5",
      prefix: "μ",
    });
    assert.deepEqual(formatMeritsCompact(2e-10, "en-US"), {
      coefficient: "200",
      prefix: "p",
    });
    assert.deepEqual(formatMeritsCompact(5e-9, "en-US"), {
      coefficient: "5",
      prefix: "n",
    });
  });

  it("preserves sign and zero", () => {
    assert.equal(formatMeritsCompactLabel(-0.42, "en-US"), "-420 m");
    assert.deepEqual(formatMeritsCompact(0), { coefficient: "0", prefix: "" });
  });
});
