import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractVatEur, parseFsDate } from "./ekasa.js";

describe("extractVatEur", () => {
  it("sums basic + reduced", () => {
    assert.equal(
      extractVatEur({ vatAmountBasic: 1.25, vatAmountReduced: 0.1 }),
      1.35,
    );
  });

  it("falls back to vatSummary", () => {
    assert.equal(
      extractVatEur({
        vatSummary: [
          { vatAmount: 0 },
          { vatAmount: 0.5 },
          { vatAmount: 1.0 },
        ],
      }),
      1.5,
    );
  });
});

describe("parseFsDate", () => {
  it("parses FS issueDate", () => {
    assert.equal(
      parseFsDate("28.06.2022 11:37:35"),
      "2022-06-28T11:37:35+02:00",
    );
  });
});
