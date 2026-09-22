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

  it("falls back to vatSummary when basic/reduced absent", () => {
    assert.equal(
      extractVatEur({
        vatSummary: [
          { vatAmount: 0, vat: { vatRate: 0 } },
          { vatAmount: 0.5, vat: { vatRate: 10 } },
          { vatAmount: 1.0, vat: { vatRate: 20 } },
        ],
      }),
      1.5,
    );
  });

  it("falls back to vatSummary when basic/reduced are explicit zeros (23% FS gap)", () => {
    // ORLEN / post–Jan 2025: standard 23% only in vatSummary; basic fields stay 0.
    assert.equal(
      extractVatEur({
        vatAmountBasic: 0,
        vatAmountReduced: 0,
        vatRateBasic: 20,
        vatRateReduced: 10,
        freeTaxAmount: 46.11,
        totalPrice: 46.11,
        vatSummary: [
          { vatBase: 37.49, vatAmount: 8.62, vat: { vatRate: 23 } },
        ],
        items: [
          {
            name: "EFECTA 95",
            vatRate: 23,
            price: 46.11,
            quantity: 25.53,
            itemType: "K",
          },
        ],
      }),
      8.62,
    );
  });

  it("falls back to item gross prices when recap rows are empty", () => {
    assert.equal(
      extractVatEur({
        vatAmountBasic: 0,
        vatAmountReduced: 0,
        vatSummary: [],
        items: [{ name: "Fuel", vatRate: 23, price: 46.11 }],
      }),
      8.62,
    );
  });

  it("returns 0 for genuine zero-VAT slips (invoice payment)", () => {
    assert.equal(
      extractVatEur({
        vatAmountBasic: 0,
        vatAmountReduced: 0,
        freeTaxAmount: 575.49,
        totalPrice: 575.49,
        vatSummary: [{ vatBase: 0, vatAmount: 0, vat: { vatRate: 0 } }],
        items: [{ name: "Úhrada faktúry", vatRate: 0, price: 575.49 }],
      }),
      0,
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
