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

Prefer, in order:

1. `vatAmountBasic + vatAmountReduced` when both present
2. Sum of `vatSummary[].vatAmount` where `vatRate > 0`
3. If recap rows missing (known FS issue from Jan 2025 on some receipts), sum item-level `items[].vatRate` / price — document chosen fallback in implementation

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

## Source

Discovered in OPD portal config (`config-opd/config-opd.js`) and `checkAPI` service:

- Base: `https://ekasa.financnasprava.sk/mdu/api/v1/opd/`
- Lookup: `POST receipt/find`
