# eKasa receipt lookup API (spike findings)

**Status:** Reverse-engineered from the official [OPD web portal](https://opd.financnasprava.sk/) (May 2026). Not published as a developer API by Finančná správa; same backend used by Over doklad, ePeňaženka, and third-party expense apps.

## QR → UID

The receipt QR encodes a **registry reference** (UID), not VAT line items. Typical form:

- `O-` + 32 hex chars (case-insensitive), e.g. `O-7AF0CFF74D45483FB0CFF74D45283FA1`
- Sometimes a URL containing that UID

Civic extracts the UID in `packages/shared` before calling FS.

## Lookup endpoint (online receipts)

```
POST https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find
Content-Type: application/json
Origin: https://opd.financnasprava.sk
Referer: https://opd.financnasprava.sk/
```

### Request body (UID-only)

```json
{
  "receiptId": "O-7AF0CFF74D45483FB0CFF74D45283FA1"
}
```

Alternative path when the buyer has no UID (offline receipt) — defer to v1.1:

```json
{
  "okp": "...",
  "cashRegisterCode": "...",
  "issueDateFormatted": "DD.MM.YYYY HH:mm:ss",
  "receiptNumber": 1474,
  "totalAmount": 7.5
}
```

### Success response

`returnValue === 0` and non-null `receipt` object.

**Verification rule for Civic:** a successful lookup means the receipt **exists in the Finančná správa e-Kasa registry** — the sale was registered with the tax authority. Treat this as **verified** for v1 (same trust model as Over doklad).

Example (abbreviated):

```json
{
  "returnValue": 0,
  "receipt": {
    "receiptId": "O-7AF0CFF74D45483FB0CFF74D45283FA1",
    "ico": "35974133",
    "cashRegisterCode": "88820221179000047",
    "issueDate": "28.06.2022 11:37:35",
    "createDate": "28.06.2022 11:37:35",
    "customerId": null,
    "dic": "2022117900",
    "icDph": "SK2022117900",
    "totalPrice": 7.5,
    "vatAmountBasic": 1.25,
    "vatAmountReduced": 0,
    "vatRateBasic": 20,
    "vatRateReduced": 10,
    "taxBaseBasic": 6.25,
    "taxBaseReduced": 0,
    "freeTaxAmount": 0,
    "vatSummary": [
      { "vatBase": 0, "vatAmount": 0, "vat": { "vatRate": 0 } },
      { "vatBase": 0, "vatAmount": 0, "vat": { "vatRate": 10 } },
      { "vatBase": 6.25, "vatAmount": 1.25, "vat": { "vatRate": 20 } }
    ],
    "items": [ "..." ],
    "organization": { "name": "...", "ico": "...", "..." },
    "unit": { "..." }
  },
  "searchIdentification": { "..." }
}
```

### VAT total for Merit conversion

Implemented in `extractVatEur` (`services/api/src/ekasa.ts`). Prefer, in order:

1. `vatAmountBasic + vatAmountReduced` when that **sum is positive**
2. Sum of `vatSummary[].vatAmount` where `vatRate > 0`
3. If recap rows are empty/zero (known FS issue from Jan 2025: **23%** standard rate often leaves basic/reduced at `0` while amounts only appear in `vatSummary` or items), derive from items: for each line with `vatRate > 0`, VAT = `price × rate / (100 + rate)` (`price` is gross)

Do **not** treat `vatAmountBasic`/`vatAmountReduced` present-as-zero as final — that wrongly yields `0` ME on valid 23% slips (e.g. ORLEN fuel) while `vatSummary` still has the real DPH.

### Error / non-verified cases

| Condition | Civic handling |
|-----------|----------------|
| `returnValue !== 0` or HTTP error | Show FS error; do not allow claim |
| `receipt === null` with `notification` | Unknown UID, offline pending, or out-of-range — map notifications in spike |
| WAF / connection failure | Retry with backoff; surface “registry unavailable” |
| Invalid UID format | Reject before calling FS |

### Operational notes

- **Undocumented** — no official ToS for third-party use; endpoint may change or be rate-limited.
- **Headers:** requests without `Origin` / `Referer` matching OPD may be blocked by WAF.
- **Dead portals:** [overenie.financnasprava.sk](https://overenie.financnasprava.sk/) returns 404; OPD web UI UX is poor, but this API works.
- **Not buyer-bound:** `customerId` is often null; receipt proves a registered sale, not who paid (see plan §10).

### Spike confirmation (2026-08)

Live `POST /receipts/verify` → FS `receipt/find` with OPD headers works from the Civic API host.

**Reference UID** `O-7AF0CFF74D45483FB0CFF74D45283FA1` → JYSK, total €7.50, VAT €1.25 → 1.67 ME preview.

**Samples from `receipts/`** (QR / printed UID → verify):

| File | Merchant | UID | Total € | VAT € | ME preview | Notes |
|------|----------|-----|---------|-------|------------|-------|
| IMG_1035 | JYSK | `O-3C5EDB38C1E24F189EDB38C1E23F18F9` | 25.65 | 4.28 | 5.71 | Printed line shows `0-` (zero); QR/API use `O-` |
| IMG_1645 | Decathlon SK | `O-FE7C5796C4EC4583BC5796C4EC258357` | 49.00 | 8.17 | 10.89 | Matches slip VAT 8.17 |
| IMG_1366 | FAST PLUS / Planeo | `O-38A58AB0973B4F2BA58AB0973B1F2BE0` | 44.98 | 7.50 | 10.00 | Printed `0-` |
| IMG_5940 | FAST PLUS / Planeo | `O-EAED8F80C07F4F0BAD8F80C07F9F0B85` | 8.00 | 1.33 | 1.77 | Printed `0-` |
| IMG_3364 | NAY a.s. | `O-3E5586E8926C44909586E8926C54904C` | 575.49 | **0** | 0 | Invoice payment (`úhrada faktúry`) — no VAT on this eKasa slip |
| IMG_4075 | Lidl | `O-EEC76C817674483F876C817674983F97` | 83.26 | 12.26 | 16.35 | BB store |
| IMG_4154 (one of two) | Lidl | `O-F948AA61783746A088AA61783756A049` | 57.55 | 9.18 | 12.24 | Malacky; second slip QR not decoded in batch |
| IMG_1191 | ŠPORT ÁČKO | `O-07B05D31FD864CD6B05D31FD86DCD6B7` | 175.85 | 29.31 | 39.08 | |
| IMG_0299 / IMG_0300 | — | — | — | — | — | QR not readable from photo (zbar) |

**Parser note:** accept printed `0-…` and normalize to `O-…` (`packages/shared` `parseReceiptUid`).

**Still open:** map `notification` when `receipt` is null; inspect `organization` street/city for merchant geofence; `customerId` prevalence on these payloads.

## Source

Discovered in OPD portal config (`config-opd/config-opd.js`) and `checkAPI` service:

- Base: `https://ekasa.financnasprava.sk/mdu/api/v1/opd/`
- Lookup: `POST receipt/find`
