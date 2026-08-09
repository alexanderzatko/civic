import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractVatEur,
  formatFsAddress,
  normalizeReceiptDetail,
  parseFsDate,
} from "./ekasa.js";

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

describe("normalizeReceiptDetail", () => {
  it("maps merchant, store, items, and VAT rows", () => {
    const detail = normalizeReceiptDetail(
      {
        receiptId: "O-AAA",
        issueDate: "28.06.2022 11:37:35",
        totalPrice: 7.5,
        vatAmountBasic: 1.25,
        vatAmountReduced: 0,
        taxBaseBasic: 6.25,
        taxBaseReduced: 0,
        vatRateBasic: 20,
        vatRateReduced: 10,
        ico: "35974133",
        organization: {
          name: "JYSK s.r.o.",
          streetName: "Šoltésovej",
          propertyRegistrationNumber: "14",
          postalCode: "81108",
          municipality: "Bratislava",
        },
        unit: {
          streetName: "Petra Hostinského",
          propertyRegistrationNumber: "7",
          postalCode: "97901",
          municipality: "Rimavská Sobota",
        },
        items: [
          { name: "Matrac  ", quantity: 1, price: 20, vatRate: 20, itemType: "K" },
        ],
        vatSummary: [
          { vatBase: 6.25, vatAmount: 1.25, vat: { vatRate: 20 } },
        ],
      },
      "O-FALLBACK",
    );
    assert.equal(detail.receipt_uid, "O-AAA");
    assert.equal(detail.merchant_name, "JYSK s.r.o.");
    assert.equal(detail.merchant_address, "Šoltésovej 14, 81108 Bratislava");
    assert.equal(
      detail.store_address,
      "Petra Hostinského 7, 97901 Rimavská Sobota",
    );
    assert.equal(detail.items[0]?.name, "Matrac");
    assert.equal(detail.vat_summary[0]?.vat_amount_eur, 1.25);
    assert.equal(detail.vat_eur, 1.25);
  });
});

describe("formatFsAddress", () => {
  it("returns null when empty", () => {
    assert.equal(formatFsAddress({}), null);
  });
});
