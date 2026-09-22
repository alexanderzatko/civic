---
name: Civic
overview: Plan for Civic — a Slovak-first mobile contribution hub (Expo) + API backend. Three Merit-earning paths (taxes via eKasa receipt scan, charity donations, volunteer work). v1 builds the VAT-receipt path end-to-end and ships the other paths as navigational stubs hyperlinking to Rovas. Users sign in via Rovas OAuth (Google, Facebook, Rovas account). Monorepo at ~/Documents/homeProjects/civic; Rovas gets OAuth server + claim rule + read endpoints for charity/community aggregates.
todos:
  - id: plan-approval
    content: Review and approve this plan (hourly wage source, FS lookup approach, fraud defaults)
    status: completed
  - id: mockup-review
    content: "Review 6-screen Slovak mockup; sign off IA + copy before scaffolding (mockup removed from repo — superseded by Expo app)"
    status: completed
  - id: spike-ekasa-api
    content: "Spike: confirm FS receipt/find contract on real UIDs; document error notifications in ekasa-receipt-api.md"
    status: completed
  - id: fraud-mitigation-v1
    content: "Implement v1 fraud controls: 3-strike, 1-day claim window (env toggle), purchase≥registration, same-store daily cap (env toggle), min VAT — no location rules"
    status: completed
  - id: spike-rovas-oauth
    content: "Spike: install oauth2_server contrib on dev; verify PKCE (patch drupal.org#3015065 if needed); register civic OAuth client; HybridAuth on authorize page"
    status: completed
  - id: rovas-oauth-server
    content: "Rovas repo: oauth2_server contrib + thin rovas_oauth wrapper (HybridAuth login UI, Services Bearer auth); claim rule"
    status: completed
  - id: scaffold-civic-repo
    content: "Scaffold civic monorepo with pnpm workspaces: apps/mobile, services/api, packages/shared"
    status: completed
  - id: phase1-verify-preview
    content: "Phase 1: navigational shell for screens 0/1/3/4/5 + Expo scan + API verify + Merit preview (no Rovas grant yet)"
    status: completed
  - id: phase2-rovas-grant
    content: "Phase 2: rules_proxy_claim_vat_receipt + OAuth login in Expo + API claim flow on dev.rovas.app"
    status: completed
  - id: receipt-sharing-design
    content: "Approve split-claims UX (search, memory, always-share, default equal split, override) and atomic multi-beneficiary claim contract — see §7"
    status: completed
  - id: receipt-sharing-impl
    content: "Phase 2: ship split-claims end-to-end — /users/search + claim shares array + Rovas {civic_claim_shares} + multi-beneficiary rules_proxy_claim_vat_receipt + mobile split UI on screen 2"
    status: in_progress
  - id: mockup-split-claims
    content: "Extend mockup with split-claims sub-screens before Phase 2 (done; mockup later removed — Expo app is source of truth)"
    status: completed
  - id: phase3-polish-deploy
    content: "Phase 3: history dashboard, SK i18n, API deployment, EAS store prep"
    status: pending
---

# Civic — Pre-Implementation Plan

**Status:** Approved — Phase 2 in progress (split claims UI + Rovas `/users_search` handoff). Wage basis: **net** (see `packages/shared/src/settings.ts`).

**Project root:** `/Users/sano/Documents/homeProjects/civic`

**Validated assumption:** Scanning a real eKasa receipt QR and calling the FS registry API returns VAT amounts matching the printed slip. A successful API response confirms the receipt is registered with Finančná správa (see §4).

---

## 1. Product goal

Build **Civic**, a Slovak-first mobile app that lets users see and grow their **contribution to society**, expressed in Merits (ME) on their Rovas account. Three Merit-earning paths are surfaced from day one:

1. **Tax payment** — VAT verified via eKasa receipt scan (v1); income tax later
2. **Charitable contribution** — donate to or invest in a Rovas-listed project
3. **Volunteer work** — report hours against a Rovas project

Merits represent labor-hour equivalents (Rovas convention: **10 ME = 1 hour**). Every path converts an act of economic value-surrender into the same Merit unit so a single dashboard can show the user's contribution mix.

**v1 implementation strategy:** the **VAT-receipt path is built end-to-end**. The other two paths (charity, volunteer) plus the investment side-path ship as **navigational stubs that hyperlink to existing Rovas project pages** — so the full information architecture is visible to users while the heavier Rovas-side endpoints (charity list, volunteer-report proxy, ME aggregates) are designed in later phases. See §9 for the screen-by-screen v1 status and §15 for the phase plan.

**Out of scope for v1:**

- Bank account parsing / open banking
- Income tax or payroll withholding
- OCR-only receipts without eKasa QR / UID
- Official Finančná správa endorsement
- Tax refunds or legal tax advice
- Native in-app charity donation flow (v1 hyperlinks to Rovas)
- Native in-app volunteer-report submission (v1 hyperlinks to Rovas)

**Future (not planned here):** donation receipts, eFaktúra B2B (2027+), bank estimates as non-Merit dashboard, in-app investment flow with auto-Merit yield. **Income-tax Merits + ÚPVS / slovensko.sk citizen identity** are sketched in §16 (post-v1).

---

## 2. System architecture

```mermaid
flowchart TB
    subgraph mobile ["apps/mobile — Expo"]
        Scan[QR scan / UID entry]
        Preview[Receipt + Merit preview]
        ClaimUI[Claim Merits button]
        Profile[Summary + Rovas link status]
    end

    subgraph api ["services/api — Civic API"]
        TokenValidate[Validate Rovas OAuth token]
        VerifyRoute[POST /receipts/verify]
        ClaimRoute[POST /receipts/claim]
        QrParser[QR UID parser]
        EkasaClient[eKasa FS receipt client]
        Attempts[(claim_attempts audit)]
        RovasClient[Rovas API client]
    end

    subgraph external ["External"]
        FS[ekasa.financnasprava.sk MDU API]
        RovasOAuth[Rovas OAuth server]
        RovasDev[dev.rovas.app APIs]
        ClaimRegistry[("{civic_claims} sole registry")]
    end

    Scan --> VerifyRoute
    Preview --> VerifyRoute
    ClaimUI --> ClaimRoute
    Profile --> TokenValidate

    VerifyRoute --> QrParser
    VerifyRoute --> EkasaClient --> FS
    ClaimRoute --> QrParser
    ClaimRoute --> EkasaClient
    ClaimRoute --> Attempts
    ClaimRoute --> TokenValidate
    ClaimRoute --> RovasClient --> RovasDev
    RovasDev --> ClaimRegistry
    TokenValidate --> RovasOAuth
```

**Trust boundary:** Users sign in via **Rovas OAuth** (no separate app-specific account). The Expo app stores only a Rovas **access token** (secure storage). Civic API validates that token with Rovas on every request; it never stores per-user API-KEY/TOKEN pairs.

---

## 3. Repository strategy

### Decision (confirmed)

| Piece | Where |
|-------|-------|
| Expo mobile app | **`civic`** monorepo — Cursor project at `~/Documents/homeProjects/civic` |
| Civic API | Same repo (`services/api`) |
| Shared types + Merit math | Same repo (`packages/shared`) |
| Rovas OAuth2 server | **`oauth2_server` contrib** + thin **`rovas_oauth`** custom wrapper |
| Rovas Merit grant rule | Existing **`rovas`** repo only |

**Do not** embed Expo under the Drupal tree. Rovas partner integrations are documented in the sibling repo at `../rovas/sites/all/modules/custom/rovas_api_endpoints/THIRD_PARTY_ACCOUNT_CREATION.md`.

### Monorepo layout

```
~/Documents/homeProjects/civic/          ← this project (Cursor workspace)
├── apps/mobile/          Expo (Expo Router)
│   └── locales/{sk,en}.json    ← Slovak primary (sk), English secondary (en)
├── services/api/         Node + TypeScript (Fastify or Hono)
├── packages/shared/      Types, Merit conversion, QR/UID parsing
├── docs/
│   ├── plan.md           ← this document
│   ├── architecture.md
│   ├── ekasa-receipt-api.md    ← FS lookup contract (spike findings)
│   └── rovas-integration.md
├── identity/             Brand assets (ME_logo.svg, etc.)
├── .env.example
├── pnpm-workspace.yaml
└── README.md

~/Documents/homeProjects/rovas/         ← sibling repo; Rovas-side changes only
├── sites/all/modules/contrib/oauth2_server/   ← NEW contrib dependency
├── sites/all/modules/custom/rovas_oauth/    ← thin wrapper (HybridAuth UI, Services Bearer)
├── sites/all/modules/custom/rovas_site_rules/rules/rules_proxy_claim_vat_receipt.json
└── docs/integration/civic.md
```

Optional: multi-root Cursor workspace file linking `civic` and `rovas` when editing Rules + API together.

### Language strategy

| Surface | Primary | Secondary |
|---------|---------|-----------|
| User-facing UI (Expo screens, push, app store listing) | **Slovak (`sk`)** — first target audience | English (`en`) — fallback for non-SK users |
| Code, identifiers, comments, commits, error messages, logs | **English** | — |
| Docs (this plan, ADRs, API specs) | **English** | — |
| User-facing Slack/email support copy | Slovak | English |

i18n implementation: a flat key/value JSON per locale at `apps/mobile/locales/{sk,en}.json` with `en` as the fallback chain. UI strings live behind keys (no hard-coded SK literals in components), so adding more locales later is mechanical. **Runtime:** anonymous → device preferred languages (iOS `AppleLanguages` / Android locale); signed-in → Rovas `language` from `/me` (see Rovas **Next work: expose preferred language on /rovas/me**); profile screen can override to `sk`/`en`. Mapping: `sk`→`sk`, `cs`/`cz`→`sk`, else `en`. Currency/date/number formatting uses `Intl` with `sk-SK` or `en-US` from the active UI locale.

---

## 4. eKasa verification (QR → FS registry lookup)

Third-party expense apps and the official Over doklad / ePeňaženka apps do **not** read VAT from the QR matrix. They extract the receipt **UID** from the QR, then fetch receipt details from Finančná správa servers. Civic follows the same pattern.

### Consumer surfaces (reference)

| Surface | Status | Notes |
|---------|--------|-------|
| **FS MDU API** | **Works** | Undocumented; powers OPD portal — see below |
| [opd.financnasprava.sk](https://opd.financnasprava.sk/#!/check) | Web UI confusing | Report form UX; underlying API accepts UID-only lookup |
| [overenie.financnasprava.sk](https://overenie.financnasprava.sk/) | **Dead** | Page not found |
| Over doklad / ePeňaženka (official apps) | Works | Same registry backend |
| Merchant eKasa APIs (PortOS/NineDigit) | N/A | Cash-register operators only |

Full API notes: **`docs/ekasa-receipt-api.md`**.

### QR → UID

QR content is the UID string (`O-[A-F0-9]{32}`, case-insensitive) or a URL containing it. Shared parser in `packages/shared`. Manual UID entry fallback on scan failure.

### Registry lookup (verification + VAT)

**Endpoint** (reverse-engineered from OPD portal):

```
POST https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find
Content-Type: application/json
Origin: https://opd.financnasprava.sk
Referer: https://opd.financnasprava.sk/
```

**Request** (online receipt — v1 primary path):

```json
{ "receiptId": "O-7AF0CFF74D45483FB0CFF74D45283FA1" }
```

**Success:** `returnValue === 0` and non-null `receipt` object.

**Verification rule:** a positive response means the receipt **exists in the e-Kasa registry** — the transaction was registered with Finančná správa. Civic treats this as **verified** (same trust level as Over doklad). Only verified receipts proceed to Merit preview and claim.

**VAT for Merits:** derive `vat_eur` from the response — prefer `vatAmountBasic + vatAmountReduced`, or sum `vatSummary[].vatAmount`. Also available: `totalPrice`, `items[]`, `organization.name`, `createDate`, `customerId` (often null).

**Failure:** non-zero `returnValue`, null `receipt`, HTTP/WAF errors, or unknown UID → show error; **no claim**.

### v1 flow

```mermaid
flowchart LR
    Scan[Scan QR] --> Parse[Extract receiptId]
    Parse --> FS[POST receipt/find]
    FS --> Ok{returnValue 0<br/>and receipt?}
    Ok -->|Yes| Verified[Verified receipt + VAT]
    Ok -->|No| Error[Show error]
    Verified --> Preview[Merit preview]
    Preview --> Claim[Claim with UID dedup]
```

| Case | Identifier | v1 support |
|------|------------|------------|
| Online receipt | `O-` + 32 hex chars | Yes — UID → `receipt/find` |
| Offline receipt | OKP + cash register metadata | Defer to v1.1 (alternate request body) |
| Non-eKasa / invalid QR | — | Show clear error |

### Spike task (before Phase 1 coding)

1. Confirm lookup on 3–5 real receipt UIDs; document in `docs/ekasa-receipt-api.md`.
2. Map `notification` values when `receipt` is null (offline pending, not found, etc.).
3. ~~Confirm VAT recap handling when summary rows are incomplete (FS notice re Jan 2025 DPH rates).~~ Done: `extractVatEur` falls through to `vatSummary` / item gross when basic+reduced sum to 0 (23% gap).
4. Test WAF behaviour from Civic API server IP; document required headers.
5. Record merchant address fields in FS JSON (`organization` name, street, city) for merchant-proximity geocoding (§11).

### Caveats

- **Undocumented API** — no official developer program; may change or rate-limit without notice.
- **Not buyer-bound** — registry confirms the sale happened, not who paid (§11).
- **Header sensitivity** — bare requests may be WAF-blocked; send `Origin` / `Referer` as OPD portal does.

**Gate:** Phase 1 starts after spike confirms `receipt/find` works for real UIDs and VAT totals are usable.

---

## 5. Merit conversion

Align with Rovas (`hours = merits / 10`):

```
merits = round((vat_eur / hourly_wage_eur) * 10, 2)
```

| Parameter | Source | Notes |
|-----------|--------|-------|
| `vat_eur` | FS `receipt/find` response (`vatAmountBasic + vatAmountReduced` or `vatSummary`) | Registry-verified |
| `hourly_wage_eur` | Config / env | e.g. ŠÚ average gross monthly ÷ 160; document chosen basis |
| `merits_per_hour` | Fixed `10` | Matches Rovas default |

Store `hourly_wage_eur` and `formula_version` on each claim for auditability when the rate changes annually.

**Decision (2026-08):** use **net** hourly wage. Default and overrides live in `packages/shared/src/settings.ts` / `HOURLY_WAGE_EUR` env. Document the basis in the app FAQ at launch.

### Display rounding (UI rule)

Storage and the `merits` API field keep two decimal places (`round(..., 2)`) for auditability. The mobile UI **always rounds Merit totals and EUR equivalents to whole numbers** when displaying them on screen (home dashboard, profile, community lookup, receipt history ME column, investment yields, etc.). Show units explicitly (`ME`, `€`) rather than implied; per-receipt VAT amounts in EUR keep their original precision because they are actual payments, not equivalents. Investment yields are presented per-year (whole-number ME) rather than fractional per-month.

### Splitting across multiple recipients

When a single receipt is claimed for multiple Rovas users (§7), the **total** is derived from the FS receipt exactly as above; per-share Merits are `floor(total * share_pct / 100, 2)` and any rounding residue is assigned to the scanner so the sum of per-share Merits equals the receipt total exactly. The receipt's `merits` API field always reports that total; per-share amounts live in the `shares[]` response array.

---

## 6. Civic API design

**Stack:** Node 20+, TypeScript, Fastify (or Hono), SQLite for MVP (Postgres for production), Zod for validation.

### Endpoints (v1)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/receipts/verify` | Rovas Bearer optional | Extract UID, call FS `receipt/find`; return verified preview (no grant). Optional `location` in body — stored ephemerally (session/cache) for verify→claim drift check (§11) |
| POST | `/receipts/claim` | Rovas Bearer required | Verify, location + heuristic fraud checks (§11), grant Merits via Rovas (Rovas owns UID dedup + claim persist). Body: `qr_or_uid`, optional `shares[]`, required `location: { lat, lng, accuracy_m? }` from device GPS at claim time — see §7. Civic logs `claim_attempts` only |
| GET | `/users/search` | Rovas Bearer required | Typeahead for split-claim recipients (§7). `?q=<≥3 chars>`; returns up to 10 `{ rovas_uid, username, display_name }` rows. Proxies the new Rovas search endpoint (§8c). Separate from `/users/lookup` |
| GET | `/users/me/summary` | Rovas Bearer required | Total VAT claimed, total ME, receipt count, Rovas profile hint — proxies Rovas claim summary (§8c) |
| GET | `/receipts` | Rovas Bearer required | Paginated claim history for authenticated `rovas_uid` — proxies Rovas claim reads (§8c); shares received + receipts submitted (§7) |
| GET | `/me/contributions/summary` | Rovas Bearer required | Per-category ME breakdown for screen 0 (taxes, charity, volunteer); taxes/receipt stats from Rovas claim summary once live — charity/volunteer 0 until those paths ship |
| GET | `/community/contributions/summary` | Public | Aggregate ME totals + per-category breakdown for the logged-out screen 0 |
| GET | `/charities/projects` | Public | `type=charity`: proxies Rovas `GET /rovas/civic_charity_projects` (approved charities; `total` + top/`query` list). `type=invest`: static curated stubs until invest path ships. |
| GET | `/rank/distribution` | Public (Rovas Bearer optional) | Proxies the existing **Rovas Merit Distribution** module Services endpoint; returns log-scale buckets `[{ label, count }]` for the histogram on screen 0. With a Bearer token, the response also returns `user_bucket_index` so the mobile app can highlight the caller's bucket and label it with their Rovas username |
| GET | `/users/lookup` | Rovas Bearer required | Community public profile — `?username=<rovas_username>` proxies Rovas `GET /rovas/users_lookup`; returns `UserLookup` (`rovas_uid`, `display_name`, `total_me`, `by_category`, tax months, top charity/volunteer). Percentile computed on Civic from `/rank/distribution`. |
| GET | `/users/me/merit-history` | Rovas Bearer required | Paginated Merit ledger for Profil — proxies Rovas `GET /rovas/civic_merit_history` (Views `merit_history` / `page_1`). |

No local auth endpoints — login happens entirely via Rovas OAuth in the Expo app.

Endpoints marked **stub** in §9 are backed by `/charities/projects`, `/community/contributions/summary`, `/rank/distribution`, and `/users/lookup`. They never write — they only read and forward to Rovas.

### Claim flow (server-side)

```mermaid
sequenceDiagram
    participant App as Expo
    participant API as CivicAPI
    participant FS as ekasa.financnasprava.sk
    participant Attempts as claim_attempts
    participant Rovas as dev.rovas.app

    App->>API: POST /receipts/claim {qr_or_uid, location}<br/>Authorization Bearer rovas_token
    API->>Rovas: introspect or validate JWT
    Rovas-->>API: rovas_uid
    API->>API: parse QR → receiptId
    API->>FS: POST /mdu/api/v1/opd/receipt/find
    FS-->>API: receipt + vat totals
    alt not verified
        API-->>App: 404 or 422 Receipt not found
    else verified
        API->>API: location + heuristic fraud checks (§11)
        alt rejected (travel / merchant / etc.)
            API->>Attempts: log rejection + GPS
            API-->>App: 422 Fraud check failed
        else passed checks
            API->>API: compute merits preview
            API->>Rovas: POST rules_proxy_claim_vat_receipt<br/>Bearer same token
            alt uid already claimed on Rovas
                Rovas-->>API: 409 duplicate_receipt
                API->>Attempts: log duplicate + GPS
                API-->>App: 409 Already claimed
            else new uid
                Rovas-->>API: merits_awarded (persists {civic_claims})
                API->>Attempts: log claimed + GPS
                API-->>App: success + merits
            end
        end
    end
```

### Data model (MVP)

**Claim registry (Rovas only — sole SoT):** `{civic_claims}` / `{civic_claim_shares}` — `receipt_uid` (UNIQUE globally), scanner, VAT, Merits, merchant, purchase time, per-beneficiary shares. Civic does **not** mirror these tables. Dedup and claim history live only on Rovas.

**claim_attempts** (Civic SQLite — ops/fraud audit, not a claim registry) — id, receipt_uid, submitted_by_rovas_uid, outcome (`claimed` | `duplicate` | `rejected_window` | `rejected_rate` | `rejected_shares` | `rejected_vat` | `rejected_strikes` | `rejected_account_age` | `rejected_same_store` | `error`; legacy `rejected_location` unused), claim_lat/lng (optional), store_key (nullable; same-store rule), created_at — used for strike counting, rate limits (`outcome = claimed`), same-store daily caps, and audit. Strikes always attach to the scanner, not to recipients. `receipt_uid` here is audit context only (no UNIQUE).

**user_strikes** — rovas_uid, strike_count, blocked_until (nullable), updated_at — updated on duplicate outcomes.

No local `users`, `rovas_links`, `receipt_claims`, or `receipt_claim_shares` tables — identity comes from the OAuth token; claim identity from Rovas. The per-device recipient memory for split claims lives only on the client (§7).

**Dev reset:** clear Rovas `{civic_claims}` (+ shares) to re-allow a QR; optionally truncate Civic `claim_attempts` for a clean rate-limit/strike slate.

---

## 7. Receipt sharing (split claims)

**Motivation.** Many real purchases are paid from a shared household budget — one person scans the receipt, but the VAT effectively came from multiple Rovas users (typically a family). v1 makes this explicit: at claim time the scanner can split a receipt's Merits across several Rovas users, instead of forcing a "first to scan keeps everything" race or after-the-fact corrections.

### User flow (screen 2, between verify and claim)

```mermaid
flowchart LR
    Verified[Verified receipt<br/>+ Merit preview] --> Default[Default: 100% to scanner<br/>+ always-share recipients]
    Default --> Add["+ Pridať osobu"]
    Add --> Search[Search Rovas user]
    Add --> Recent[Pick from previously-shared list]
    Search --> Rebalance[Auto equal split]
    Recent --> Rebalance
    Rebalance --> Override[Optional: override per row]
    Override --> Claim[Claim — single FS verify,<br/>atomic multi-beneficiary grant]
```

Defaults and constraints:

- A fresh scan starts at **100% to the scanner**, plus any **vždy zdieľať** (always share) recipients pre-populated from local memory; the initial split is recalculated to be **equal across all included recipients**.
- Adding or removing a recipient triggers automatic equal-share recalculation across the new set; users can then override any row. The UI rebalances remaining rows so percentages always sum to 100 within rounding tolerance (server still validates).
- Each row shows: avatar, Rovas display name + `@username`, share %, remove icon, and — for memorised rows — a **vždy zdieľať** toggle.
- **The scanner is always included** as one of the recipients in v1 (cannot drop themselves to 0). Pure delegation/transfer of a receipt to other users is out of scope.
- A claim must have **at least one recipient** (always the scanner in solo mode) and **no duplicate recipients**.

### Recipient discovery

| Source | Behaviour |
|--------|-----------|
| **Search** | Autocomplete against `/users/search?q=<prefix>` (≥ 3 chars). Returns up to 10 `{ rovas_uid, username, display_name }` matches. Backed by new Rovas endpoint (§8c). |
| **Memory (local)** | Recently-selected recipients persisted on-device (e.g. `AsyncStorage`; OAuth tokens still use `expo-secure-store`). Sorted by last-used, capped at ~20 entries; LRU eviction. |
| **Always-share** | Subset of memory the user has flagged. Auto-included on every new scan (and visible/removable in that scan's split list). Toggling off removes the auto-include but keeps the user in memory. |

Memory is purely client-side in v1 — there is no server-side address book. The server only ever sees the final `shares` array for the claim being submitted. Uninstalling the app erases the memory.

### Split rounding (UI + server)

- UI surfaces whole-percent values to the user, but `share_pct` is stored and transmitted with up to 2 decimal places.
- Per-share Merit amount: `floor(total_merits * share_pct / 100, 2)`; any **rounding residue is assigned to the scanner** so the sum of per-share Merits equals the receipt total exactly. The residue is recorded on the scanner's share row (`rounding_residue`) for auditability.
- Server validates `sum(share_pct) == 100 ± 0.01`; otherwise rejects with `rejected_shares` (no Rovas call made).

### API changes (Civic API, §6)

| Method | Path | Change |
|--------|------|--------|
| POST | `/receipts/claim` | Body now accepts `shares?: [{ rovas_uid, share_pct }]`. Omitted → defaults to `[{ rovas_uid: caller, share_pct: 100 }]`. Validation: ≥ 1 share, scanner included, distinct `rovas_uid`s, sum ≈ 100. Response now contains `total_merits` plus a `shares[]` array with per-beneficiary `merits_awarded`. |
| GET | `/users/search` | **New.** Bearer required. `?q=<≥3 chars>` returns up to 10 `{ rovas_uid, username, display_name }` rows. Lightweight typeahead — distinct from the heavier `/users/lookup` (Phase 3+ public-profile endpoint for screen 6). |

### Claim registry (Rovas) + Civic ops

Claim parent + children live **only on Rovas** (`{civic_claims}` / `{civic_claim_shares}`). Civic does not persist claim or share rows; it logs `claim_attempts` for fraud/ops.

History (Civic proxies Rovas reads — see §8c / `docs/integration/civic.md`):

- "Moje merity z bločkov" (Merits I received) = Rovas claims where caller is a beneficiary share.
- "Moje naskenované bločky" (receipts I submitted) = Rovas claims where caller is the scanner.

### Server-side claim flow (amended)

```mermaid
sequenceDiagram
    participant App as Expo
    participant API as CivicAPI
    participant FS as ekasa.financnasprava.sk
    participant Rovas as dev.rovas.app

    App->>API: POST /receipts/claim {qr, shares[]}
    API->>API: validate shares (sum ≈ 100, distinct uids,<br/>scanner included)
    API->>FS: receipt/find (once)
    FS-->>API: verified receipt + VAT
    API->>API: compute per-share merits preview + residue
    API->>Rovas: rules_proxy_claim_vat_receipt {uid, shares[]}
    alt duplicate or grant fails
        Rovas-->>API: 409 / error (Drupal rolls back)
        API->>API: log claim_attempts
        API-->>App: 409 or 5xx — no partial credit
    else all granted
        Rovas-->>API: total_merits + shares[] (persisted on Rovas)
        API->>API: log claim_attempts claimed + GPS
        API-->>App: total_merits + shares[]
    end
```

Atomicity is mandatory on Rovas: either every share gets credited and recorded in `{civic_claim_shares}`, or nothing does. The Rovas rule must run all `rules_give_merits_to_user` calls inside a single Drupal transaction (§8b).

### Privacy and consent

- v1 treats included recipients as **implicitly consenting** — the canonical use case is family members sharing a household budget, where explicit per-receipt confirmation would be friction without value. Recipients see the Merit credit in their Rovas account and can flag abuse out-of-band.
- The scanner only sees public Rovas fields (`username`, `display_name`) via `/users/search` — no email, no balance, no contributions.
- Recipient memory lives only on the scanner's device; uninstalling the app erases it.
- **Phase 3+:** Rovas-side opt-out preference ("Don't include me in others' split claims"); when set, the user is filtered from `/users/search` results and any submitted claim including them is rejected (`rejected_shares`).

### Fraud impact (cross-reference §11)

- Strikes always attach to the **scanner** (`submitted_by_rovas_uid`), never to passive recipients.
- Per-recipient monthly Merit cap (Tier 2) applies to the credited beneficiary, not the scanner — so a scanner cannot dump unlimited Merits onto one recipient.
- Per-(scanner → recipient) monthly Merit cap (Tier 2) limits how much one user can route to another, deterring Merit-laundering rings. Default is high enough not to interfere with normal family use.
- Failed share validation increments `claim_attempts` with outcome `rejected_shares`.
- Location and heuristic rejections (`rejected_location`, `rejected_merchant_distance`, etc.) attach to the scanner; see §11.

### Rovas changes summary (cross-reference §8)

- `rules_proxy_claim_vat_receipt` accepts a `shares` array; loops `rules_give_merits_to_user` atomically per beneficiary; solo claims are just a one-entry array (§8b).
- New `GET /rovas/users/search?q=` Services endpoint returns minimal public-profile rows for typeahead — separate from the heavier `/users/lookup` planned for Phase 3+ (§8c).

### Phasing

- **Phase 1** — not present (no claim flow yet; verify-preview only).
- **Phase 2** — ships split claims end-to-end together with the basic claim flow, so v1 production never has a "solo-only" claim phase. Includes Rovas `/users/search`, the multi-beneficiary rule (Rovas `{civic_claim_shares}`), Civic claim reads proxy, and the mobile split UI on screen 2.
- **Phase 3** — opt-out preference, server-side address book if user research justifies one, possible recipient-side notifications.

---

## 8. Rovas integration (rovas repo)

Rovas changes fall into two tracks: **OAuth server** (new, for login) and **Merit grant API** (new rule).

### 8a. Rovas OAuth2 server (oauth2_server contrib)

Rovas today uses HybridAuth only as an **OAuth client** (login via Google, Facebook, Nabezky, etc.). There is **no OAuth server** in the repo yet.

**Decision:** Use the Drupal 7 contrib module **[oauth2_server](https://www.drupal.org/project/oauth2_server)** as the authorization server foundation.

Add a thin custom module **`rovas_oauth`** (depends on `oauth2_server`) for Rovas-specific glue only:

| Responsibility | Module |
|----------------|--------|
| OAuth2 server core, clients, scopes, token storage | **oauth2_server** (contrib) |
| Login UI on authorize page (HybridAuth + Drupal login) | **rovas_oauth** |
| Map Bearer token → `rovas_uid` for Services rules | **rovas_oauth** |
| Export **civic** OAuth client config for dev/prod | **rovas_oauth** (Features or documented manual setup) |

**OAuth client:** Register the **civic** mobile app in oauth2_server admin with:

- Grant type: **Authorization Code** (+ **PKCE** — see caveat below)
- Redirect URIs: `civic://oauth/callback` (production), Expo dev redirect for development
- Scopes: start with module defaults; add custom scope e.g. `merits:claim` if needed
- Public client (no client secret) for mobile

**PKCE caveat (Phase 0 spike):** Tracked in [drupal.org#3015065](https://www.drupal.org/project/oauth2_server/issues/3015065). Spike must confirm PKCE on dev; extend **`rovas_oauth`** if the contrib patch is insufficient.

**Partner API (`rovas_partner_user`)** remains for other integrations, not Civic login.

### 8b. Merit grant and read APIs

| Endpoint | Role |
|----------|------|
| `POST /rovas/rules/rules_user_s_merits` | Read Merit balance (Bearer or API-KEY auth) |
| `rules_give_merits_to_user` | Called inside new claim rule (internal) |

Dev target: **`https://dev.rovas.app`**

### New: `rules_proxy_claim_vat_receipt`

**Logic (summary):**

1. Resolve caller (the scanner) via **OAuth Bearer** (preferred) or legacy API-KEY/TOKEN
2. Reject if `receipt_uid` already in `{civic_claims}` — **sole** global UID dedup (Civic does not keep a claim registry)
3. Validate the incoming `shares` array (§7): non-empty, distinct `beneficiary_rovas_uid` values, percentages sum to 100 (± rounding tolerance), each beneficiary resolves to a real Rovas user, scanner is included
4. Compute total merits, then per-share Merit amounts (`floor(total * share_pct / 100, 2)`, scanner absorbs rounding residue)
5. Inside a single Drupal transaction, invoke `rules_give_merits_to_user` once per beneficiary — **atomic**: any failure rolls the whole claim back so partial Merit credit is impossible
6. Persist the claim + per-beneficiary rows in `{civic_claims}` / `{civic_claim_shares}` (sole claim SoT)
7. Return `{ total_merits_awarded, shares: [{ beneficiary_rovas_uid, merits_awarded }], result, result_explain }`

A solo claim is just a shares array of one entry at 100%, so this same code path covers both flows.

**Expose via Services:** `POST /rovas/rules/rules_proxy_claim_vat_receipt`

**Pointer doc in rovas:** `docs/integration/civic.md`

### Rovas spikes (Phase 0)

- Install **oauth2_server** on dev.rovas.app
- Verify **PKCE** end-to-end (patch #3015065 if needed)
- Register **civic** OAuth client; confirm Authorization Code + PKCE with Expo or curl
- Prototype **rovas_oauth** authorize page with Google + Facebook HybridAuth
- Confirm Bearer token resolves to `rovas_uid` for Services rules

### 8c. Rovas read endpoints used by Civic

Civic's home, earn-hub, and community screens consume read-only signals from Rovas. Some are existing module endpoints we just need to expose / expose-via-Services; others are new and gated behind later phases.

| Endpoint (working name) | Used by (Civic screen) | Returns | Status |
|-------------------------|------------------------|---------|--------|
| `GET /rovas/merit_distribution` | Screen 0 (rank histogram) | Log-scale buckets `[{ label, count }]` for global Merit balance distribution; with auth, includes `user_bucket_index` so the highlighted bar and username label can be drawn | **Existing** — produced by the **Rovas Merit Distribution** module already in production. v1 just needs Services-Bearer auth confirmed and Civic API proxying. |
| `GET /rovas/civic_charity_projects` | Screen 3 (Charitatívne projekty) | Approved charity catalog `{ total, projects[] }` sorted by `total_me`; optional `query` / `limit` / `lang` | **Next work** — see Rovas `docs/integration/civic.md` → charitable projects (Civic catalog) |
| Rovas page `/charity-projects` | Screen 3 (invite form) | Public enrollment why/how for charities; linked from Civic mailto invite | **Next work** — same Rovas section |
| `GET /rovas/projects?type=invest` | Screen 5 (Investičné projekty) | Same shape; `expected_yield_me_per_month` extension | Phase 2 stretch |
| `GET /rovas/contributions/aggregate` | Screen 0 logged-out + per-user position calc | `{ total_me, by_category: { taxes, charity, volunteer } }`, plus optional `user_percentile` when called with Bearer | Phase 2 stretch |
| `GET /rovas/users/search?q=…` | Screen 2 (split-claim recipient picker, §7) | Minimal `[{ rovas_uid, username, display_name }]` for typeahead. `q` ≥ 3 chars, ≤ 10 results, public fields only. Honours per-user "not searchable" preference (Phase 3+). | **Phase 2** — ships with the multi-beneficiary claim rule. Separate from `/users/lookup`. |
| `GET /rovas/civic/claims?view=submitted\|received` | Screen 2 history tabs | Paginated claim/share rows from `{civic_claims}` / `{civic_claim_shares}` (sole claim SoT) | **Done** — Rovas live; Civic proxies via `GET /receipts?view=` |
| `GET /rovas/civic/claims/summary` | `/me/contributions/summary` taxes + receipt stats | `{ receipt_count, total_vat_eur, taxes_me }` (or equivalent fields on `/rovas/me`) | **Done** — Rovas live; Civic wires into `/me/contributions/summary` |
| `GET /rovas/users_lookup?username=…` | Screen 6 (Komunita) | Public-profile shape: `rovas_uid, username, display_name, total_me, by_category, taxes_last_3_months[], top_charities[], top_volunteer_projects[]`. Machine-name path (no slash). Honours searchable preference (404 if private). Percentile computed on Civic. | **Live** — see Rovas `docs/integration/civic.md` → users lookup |
| `GET /rovas/civic_merit_history` | Profil (Merit ledger) | Paginated `{ total, items[] }` mirroring Views `merit_history` / `page_1` (`/user/%/merits`): date, source kind (project / report / purchase), title, ME. Bearer = reward recipient. | **Phase 2** — see Rovas **Next work: merit history (profile ledger)** |
| `POST /rovas/rules/rules_proxy_volunteer_report` | Screen 4 (Dobrovoľnícka práca) | Submits a simplified volunteer report (project, date, hours, description) and returns Merit grant outcome | Phase 3 |

**v1 behaviour:**

- **Screen 0 (rank histogram)** — calls the existing Merit Distribution endpoint via Civic API on day one. This is the only stub-related Rovas endpoint that already exists; no Phase-2 swap needed.
- Screens 3 and 5: screen 3 uses the live public charity catalog when Rovas ships (**Next work: charitable projects**); until then Civic proxies and surfaces errors. Screen 5 still renders a **statically curated** invest list.
- Screen 3 also ships an **invite-organisation** e-mail form (collapsible card below the list). The preset body links to **`{ROVAS}/charity-projects`** — that Rovas landing page is part of the same Next work.
- Screen 0 logged-out shows a placeholder community total (or hides the aggregate block) until the aggregate endpoint lands.
- Screen 4 disables submit and shows a "coming soon" notice with a link to the existing Rovas form.
- **Screen 6 (Komunita)** — username search → public contribution profile via `/users/lookup`; device-local recent profiles; friend invite via client `mailto:` (no mailer / no Rovas invite API; “contacts after registration” out of scope).

Promotion path: when each Rovas endpoint ships, swap the corresponding Civic API stub from a static-config response to a live proxy. No Civic mobile changes beyond removing the "stub" badge and enabling disabled controls.

---

## 9. Expo mobile app

### Stack

- **Expo SDK 52+** with Expo Router
- **TypeScript**
- **expo-camera** (barcode scanning)
- **expo-location** — foreground GPS at claim time (required permission; §11 travel-consistency checks)
- **expo-secure-store** for Rovas OAuth tokens
- **expo-auth-session** — Authorization Code + PKCE
- **i18n:** Slovak primary, English secondary

### Screens (v1)

Slovak labels are the user-facing source of truth (see §3 Language strategy). Routes use English identifiers. Screen layout and copy live in the Expo app under `apps/mobile` (locales in `apps/mobile/locales/`).

| # | Route | Slovak label (UI) | English (dev) | v1 status |
|---|-------|-------------------|---------------|-----------|
| 0 | `/(tabs)/index` | Váš príspevok spoločnosti | Home / contribution dashboard | **Fully built** — logged-in: user ME total (rounded, whole-number) + EUR equivalent + **rank histogram** (sourced from existing Rovas Merit Distribution module, §8c) with the user's bucket highlighted and username labelled + community-position callout (the word "komunite" deep-links to screen 6). Logged-out: aggregate community total + same rank histogram without highlight + sign-in/register CTAs. |
| 1 | `/(tabs)/earn` | Získať merity | Earn hub | **Fully built** — three numbered cards routing to children |
| 2 | `/(tabs)/earn/receipts` | Bločky | Receipts | **Fully built** — eKasa scan + claim history (the §4 / §6 receipt flow lives here). After verify and before claim, the user can **split the Merits across multiple Rovas users** (§7): the scanner is pre-seeded at 100% plus any "vždy zdieľať" recipients from local memory; recipients are added via a Rovas-user search dialog or picked from a previously-shared list; shares default to equal split with per-row override. History tabs show both "Moje merity z bločkov" (shares the user received) and "Moje naskenované bločky" (receipts the user submitted). |
| 3 | `/(tabs)/earn/charity` | Charitatívne projekty | Charity projects | **Built (discovery)** — public catalog via `/charities/projects?type=charity` → Rovas `civic_charity_projects` (top 5 by project `total_me`; search when `total ≥ 6`); row opens in-app `ProjectDetailModal` (donate instructions); invite-organisation collapsible `mailto:` appends enrollment URL (`/charity-projects`). No in-app payments. Rovas **Next work: charitable projects (Civic catalog)**. |
| 4 | `/(tabs)/earn/volunteer` | Dobrovoľnícka práca | Volunteer report | **Stub** — form skeleton mirroring the simplified Rovas form; submit disabled with "coming soon" until §8c proxy ships |
| 5 | `/(tabs)/earn/invest` | Investičné projekty | Investment projects | **Stub** — list backed by `/charities/projects?type=invest`; each item hyperlinks to `rovas.app/project/<id>` |
| 6 | `/(tabs)/community` | Komunita | Community / user lookup by Rovas username | **Built** — search + public profile stack; recents in SecureStore; invite-friend mailto last |
| — | `/(auth)/login` | Prihlásenie | Login | **Fully built** — Rovas OAuth (Google / Facebook / Rovas) |
| — | `/(auth)/register` | Registrácia | Registration | **Fully built** — same OAuth providers, framed for first-time users; HybridAuth auto-creates the Rovas account |
| — | `/(tabs)/profile` | Profil | Profile | **Fully built** — Rovas user info, sign out, language. **Phase 2:** Merit acquisition history on this screen — parity with Rovas `/user/<uid>/merits` (Views `merit_history` / `page_1`), proxied via `GET /users/me/merit-history`. |

The earn-hub child routes (`/earn/receipts`, `/earn/charity`, `/earn/volunteer`, `/earn/invest`) are reached from screen 1's primary CTAs and from inter-screen links on the home and earn screens. Screen 0 surfaces a single primary CTA — "Získať merity" — that routes to screen 1, and inline links such as "komunite" inside the **Vaša pozícia v komunite** callout deep-link to screen 6.

**Navigation TODO:** v1 reaches every screen via inline CTAs and Rovas hyperlinks. As the IA grows past ~6 screens we expect to introduce a **proper navigation menu** — most likely a bottom-tab bar (Domov / Získať / Bločky / Komunita / Profil) with the earn-hub children promoted to a stack inside the "Získať" tab. Track this when the screen count or session-length data justifies it; not part of v1 scope.

### App identifiers

- OAuth redirect scheme: **`civic://oauth/callback`**
- Expo `slug` / package name: **`civic`** (finalize in `app.json` at scaffold time)

---

## 10. Authentication model

**No separate app account.** User identity is the **Rovas user** established through OAuth.

```mermaid
sequenceDiagram
    participant App as Expo
    participant Browser as SystemBrowser
    participant Rovas as Rovas OAuth
    participant HA as HybridAuth
    participant API as CivicAPI

    App->>Browser: Open /oauth/authorize PKCE
    Browser->>Rovas: User chooses login method
    Rovas->>HA: Google or Facebook or Drupal login
    HA-->>Rovas: Authenticated rovas_uid
    Rovas-->>Browser: Redirect with auth code
    Browser-->>App: civic://callback?code=
    App->>Rovas: POST /oauth/token code+verifier
    Rovas-->>App: access_token
    App->>API: Bearer access_token on all calls
    API->>Rovas: Validate token introspect or JWT
    Rovas-->>API: rovas_uid
```

---

## 11. Receipt fraud mitigation

**Threat:** Anyone can pick up a discarded receipt, scan the QR, and claim Merits they did not earn. eKasa receipts are **not inherently buyer-bound** — registry verification proves a sale happened, not who paid.

**Verify vs claim:** Scanning and `POST /receipts/verify` always return a verified preview when FS succeeds. Fraud rules block **Merit grant** only (`claim_allowed: false` on signed-in verify; hard reject on `POST /receipts/claim`). Users can still inspect the receipt.

### What FS verification exposes

| Field | Source | Useful for buyer binding? |
|-------|--------|---------------------------|
| Receipt UID (`O-…`) | QR + FS response | Dedup only |
| VAT total | FS `receipt/find` | Registry-verified |
| Date/time, merchant / store address | FS response | Claim window, same-store cap, registration check |
| Payment method | FS `receipt.payments` when present | **No** — not linked to a person |
| **customerId** | FS response when buyer ID provided at sale | **Yes when present**, rare in retail |

### v1 fraud rules (implemented)

| Rule | Behaviour | Outcome | Toggle |
|------|-----------|---------|--------|
| **A. 3-strike** | 3 `duplicate` outcomes in `STRIKE_WINDOW_DAYS` (30) → block until `blocked_until` (`STRIKE_BLOCK_DAYS`, default 7). Strikes attach to the **scanner** only. | `rejected_strikes` | Always on |
| **B. Claim window** | Reject when `now − purchase_at` > `CLAIM_WINDOW_DAYS` (default **1** day, rolling) | `rejected_window` | `CLAIM_WINDOW_ENABLED` — **dev default `false`**; production `true` |
| **C. Registration vs purchase** | Reject when receipt Bratislava calendar day is **strictly before** Rovas account `created` day. Needs `GET /rovas/me` → `created` (Rovas task). Missing `created` → fail closed. | `rejected_account_age` | Always on |
| **D. Same-store daily cap** | Max `SAME_STORE_DAILY_LIMIT` (default **2**) successful claims per scanner + normalized store address per Bratislava calendar day. Key = FS unit address, else org address; skip if both null. | `rejected_same_store` | `SAME_STORE_DAILY_LIMIT_ENABLED` — **dev default `false`**; production `true` |
| **E. Min VAT** | Reject when VAT < `MIN_VAT_EUR` (default **0.01**) | `rejected_vat` | Always on |

Also always on: **global UID dedup** (Rovas), **claim_attempts** audit log, **rate limits** (20/day, 200/month per scanner).

`claim_attempts` stores optional `store_key` for rule D. `user_strikes` holds `strike_count` + `blocked_until`.

### Location / GPS rules — out of v1

Travel-consistency, merchant GPS proximity, verify→claim drift, and required device GPS are **not** enforced. `location` on claim/verify remains optional for forward compatibility only.

### Strike attribution for split claims

Strikes always attach to the **scanner** (`submitted_by_rovas_uid`), never to passive recipients.

### Testing fraud controls

- [ ] User A claims UID → success; user B → 409
- [ ] User B × 3 duplicates → strike block (`rejected_strikes`)
- [ ] Receipt older than claim window (when enabled) → `rejected_window`
- [ ] Daily rate exceeded → `rejected_rate`
- [ ] Purchase day before Rovas `created` → `rejected_account_age`
- [ ] Third same-store claim same Bratislava day (when enabled) → `rejected_same_store`
- [ ] VAT below min → `rejected_vat`
- [ ] Split claim with shares summing to 99 or 101 → `rejected_shares`
- [ ] Verify still returns preview when claim is soft-blocked (`claim_allowed: false`)

---

## 12. Security and privacy

| Risk | Mitigation |
|------|------------|
| OAuth token theft | PKCE, secure-store, short-lived tokens |
| Trashcan receipt fraud | §11 dedup, strikes, 1-day claim window, same-store cap, registration-vs-purchase, min VAT |
| Fake receipts | FS `receipt/find` must return verified receipt before claim |
| Merit farming | Monthly cap; server-side VAT-only computation from FS response |
| Split-claim Merit dumping | Per-recipient + per-(scanner → recipient) monthly caps (§11); recipients always free to flag abuse |
| Recipient privacy in split-claim search | `/users/search` returns only `username` + `display_name` (no email, no balance); honours per-user "not searchable" preference (Phase 3+); recipient memory is device-local only |
| GDPR | Claims keyed by `rovas_uid`; privacy policy; split-claim recipient memory stays on the scanner's device |

---

## 13. Testing strategy

- [x] FS `receipt/find` returns VAT for sample UID
- [ ] API verify same UID → VAT matches printed receipt
- [ ] Unregistered / fake UID → rejected (no claim)
- [ ] Duplicate claim returns 409
- [ ] Rovas OAuth PKCE on dev.rovas.app
- [ ] Phase 1: scan → preview on device
- [ ] Phase 2: claim increases Merit balance
- [ ] Phase 3: TestFlight / internal APK in real shop lighting

---

## 14. Deployment (high level)

| Component | MVP | Production |
|-----------|-----|------------|
| Civic API | localhost + Expo dev client | VPS subdomain (e.g. `api.civic.example.sk`) |
| Database | SQLite | Postgres |
| Expo | Expo Go | EAS → TestFlight / Play internal |
| Rovas | dev.rovas.app | rovas.app |

---

## 15. Phased delivery

### Phase 0 — Spikes + mockup approval

- FS `receipt/find` contract documented (`docs/ekasa-receipt-api.md`)
- Rovas OAuth + PKCE on dev; register **civic** client
- Hourly wage source chosen
- 6-screen IA reviewed against the user-supplied Slovak outline (initial canvas mockup; later removed — Expo app is source of truth)
- Split-claim sub-screens signed off (§7)

**Exit gate:** Receipt UID verifies via `receipt/find`; OAuth returns usable Bearer token; IA + split-claim flow signed off.

### Phase 1 — Navigational shell + verify-preview

- Scaffold **civic** monorepo and locale files (`sk` primary, `en` fallback)
- All 6 screens from §9 ship in the Expo app:
  - Screens 0, 1, 2 are fully built against live data
  - Screens 3, 4, 5 ship as **stubs** with the static curated project list (§8c) and the disabled volunteer form
- API: `/receipts/verify`, `/me/contributions/summary` (taxes-only), `/community/contributions/summary` (placeholder), `/charities/projects` (static config)
- No claim or OAuth yet — preview only

### Phase 2 — Rovas Merits + OAuth + split claims

- OAuth server, claim rule, fraud controls, Expo login + claim
- **Split claims (§7) ship end-to-end in this phase** so v1 never has a "solo-only" production claim flow:
  - Rovas: `rules_proxy_claim_vat_receipt` accepts a `shares` array atomically; new `GET /rovas/users/search` Services endpoint exposed
  - Civic API: `POST /receipts/claim` accepts `shares` + device `location`; no local claim registry (Rovas SoT); `GET /users/search` and claim history/summary proxy Rovas; per-recipient and per-(scanner → recipient) caps enforced; travel-consistency + merchant-proximity heuristics (§11)
  - Mobile: location permission prompt before first claim; GPS attached to verify + claim requests
  - Mobile: screen 2 split UI (search, memory, always-share toggle, default equal split with override, auto-rebalance, sum-to-100 validation); history split into "received Merits" vs "submitted receipts"
- `/me/contributions/summary` reads real Merit history per category, aggregating across received shares
- **Profil Merit ledger:** Rovas `GET /rovas/civic_merit_history` (Views `merit_history` / `page_1`) proxied as Civic `GET /users/me/merit-history`; Expo profile lists date / source / ME
- **Stretch:** if the new Rovas read endpoints from §8c land, swap `/charities/projects` and `/community/contributions/summary` from static config to live proxies
- **Rovas:** create the public `/charity-projects` page linked from screen 3's invite-organisation e-mail template

### Phase 3 — Polish + stores + stub promotion

- SK i18n polish, API deploy, EAS builds
- Promote stubs to first-class flows as Rovas endpoints land (volunteer-report proxy first; in-app charity / invest flows when product is ready)

---

## 16. Post-v1 — Income tax Merits + ÚPVS citizen identity

Income tax (and any other personal tax-authority data path) needs a **government-grade citizen identity**. That is a different trust layer from today’s Rovas OAuth (Google / Facebook / Rovas account). Receipt VAT works without knowing *who* paid; income tax does not.

### 16a. Two identity layers

| Layer | Role today | Role for income tax |
|--------|------------|---------------------|
| **Rovas OAuth** | App login + ME ledger SoT | Unchanged — account that receives Merits |
| **ÚPVS / slovensko.sk** | Not used | Proves *which citizen* may read personal FS tax data; binds that subject to the Rovas uid |

Do **not** replace Rovas login with ÚPVS for day-to-day use. Treat ÚPVS as an **optional elevated attach** (“Connect Slovak government identity”) required only for government-data Merit paths. A later “Sign in with slovensko.sk” option remains optional product work.

### 16b. Target verification flow

ÚPVS (behind slovensko.sk) is the IdP. Civic (or a thin bridge) is a Service Provider:

1. User is already a Rovas user in Civic.
2. For “claim income tax,” Civic starts ÚPVS login (SAML; same family as slovensko.sk — eID, Slovensko v mobile, EU eIDAS means, etc.).
3. Civic receives a SAML assertion → stable subject (typically `rc://sk/…` style URI) plus name attributes.
4. Civic **binds** that ÚPVS subject to the Rovas uid (one-time link; re-auth when tokens expire or for high-value claims).
5. With an OBO / citizen session, Civic (or FS) fetches verified tax figures for that citizen.
6. Civic verifies amount + period, then grants ME via a new Rovas rule (e.g. `rules_proxy_claim_income_tax`) — same pattern as receipt claims, but uniqueness is **one claim per citizen + tax period**, not per receipt UID.

```mermaid
sequenceDiagram
  participant App as Civic app
  participant API as Civic API
  participant UPVS as ÚPVS / slovensko.sk
  participant FS as Finančná správa
  participant Rovas as Rovas

  App->>API: Claim income tax (Rovas Bearer)
  API->>UPVS: SAML SP login if no valid citizen link
  UPVS->>API: Assertion (UPVS subject)
  API->>API: Link rovas_uid ↔ upvs_subject
  API->>FS: Fetch tax summary (citizen / OBO context)
  FS-->>API: Verified figures for period
  API->>Rovas: rules_proxy_claim_income_tax
  Rovas-->>App: ME credited
```

### 16c. Integration options

- **First-party ÚPVS SP** — Register SP metadata with NASES (Partner Framework); ACS on Civic API (or Rovas); mobile opens system browser / ASWebAuthenticationSession. Production needs formal onboarding; test uses NASES test identities, not real eID.
- **Slovensko.Digital `slovensko-sk-api`** — Docker REST proxy over ÚPVS (`/login` → OBO JWT → `/api/upvs/identity`, eDesk, filings). Speeds engineering; does **not** skip NASES partner registration for real production use.
- **FS-specific session on top of ÚPVS** — If FS later ships a citizen machine API, expect federation to the same IdP. Prefer **ÚPVS subject** as the stable join key, not “user once logged into PFS in a WebView.”

Store `rovas_uid ↔ upvs_subject` (and consent timestamps) on Civic or Rovas. Explicit connect / unlink UX; never use social login alone for income-tax claims.

### 16d. What exists today (citizen access) vs what Civic still needs

**Citizens authenticated via ÚPVS can already reach tax-related documents today** — but as **portal UX for humans**, not as a documented “my tax paid → JSON” API for third-party apps.

| Channel | Auth | What the citizen gets today |
|---------|------|-----------------------------|
| **PFS OIZ** ([financnasprava.sk](https://www.financnasprava.sk) → Osobná internetová zóna) | ÚPVS / slovensko.sk (eID, Slovensko v mobile, EU means) **or** FS ID+password | File eDP (income-tax return), Katalóg formulárov, História komunikácie (sent/received), eSpis, concepts / signed filings |
| **ÚPVS eDesk** (slovensko.sk electronic mailbox) | ÚPVS login; FO must activate mailbox for delivery | Since **1 Jan 2022**, FS delivers official electronic documents (decisions, notices, etc.) into the citizen’s ÚPVS mailbox; after acceptance they also appear in PFS eSpis |
| **FS OpenData API** | API key | **Public** registries only (VAT lists, debtors, income-tax *registration* lists, etc.) — **not** personal DPFO amounts |

Implications for Civic:

1. **Identity path is real** — PFS already federates IAM to ÚPVS SM; the same IdP Civic would use for §16b already unlocks OIZ and eDesk for the citizen in the browser.
2. **Programmatic personal tax amounts are not a public product today** — there is no known FS developer API that returns “citizen X paid Y income tax for year Z” to a third-party RP. OpenData is the wrong dataset class.
3. **Possible interim research spikes (fragile / legal):** after Civic is a registered ÚPVS SP, read FS-delivered messages from eDesk via Slovensko.Digital-style OBO APIs and attempt structured extract — PDFs / unstructured mail are a poor Merit SoT. Prefer waiting for (or partnering with FS on) an attested citizen tax-summary API.
4. **Product gate** — ship income-tax Merits only when a **machine-verifiable** amount + period exists under the linked ÚPVS subject; until then keep the earn-path stub / copy honest about “coming when FS data access allows.”

### 16e. Out of scope until spike + partner track

- NASES Partner Framework registration and production SP metadata
- Civic ACS + `rovas_uid ↔ upvs_subject` store + consent UX
- Rovas income-tax claim rule and period uniqueness
- Legal / privacy review (personal tax data, retention, unlink)
- Any scrape or unofficial PFS HTML automation

---

## 17. What we defer

- Bank/card matching, offline OKP receipts, buyer-ID binding until spike confirms fields, mock-GPS detection
- Location / GPS fraud heuristics (travel consistency, merchant proximity, verify→claim drift) — out of v1; see §11
- Auto-deduct Merits as fraud punishment, Merit leaderboard in app
- **ÚPVS / slovensko.sk citizen identity + income-tax Merits** — see §16 (identity attach + claim flow sketched; personal tax machine API not available today)
- **Lock-screen / home-screen receipt-scan widget (post-v1)** — iOS WidgetKit / Android App Widget (or a lock-screen quick action) that deep-links into Civic scan mode. Target UX: user pays in-store with the phone, keeps the receipt in hand, taps the widget on the lock/home screen, and lands directly in QR scanning without navigating the earn hub. Not in the current implementation pass.
- **Merit acquisition history** — **Phase 2 on Profil** (was post-v1). Cross-path ledger from Rovas Views `merit_history` / `page_1`, proxied as `GET /users/me/merit-history`. Receipt-only tabs on screen 2 remain.

---

## 18. Approval checklist

1. Plan scope approved
2. Hourly wage basis for Merit formula
3. OAuth providers: Google + Facebook + Drupal login
4. FS lookup via undocumented `receipt/find` API — acceptable for v1 (see §4)
5. Fraud defaults: 1-day claim window + same-store daily cap (env-toggled; on in production), 3-strike / 7-day block, purchase ≥ Rovas registration, min VAT €0.01; **no** location GPS rules in v1
6. Three-path framing approved — receipts only fully built in v1; charity / volunteer / invest ship as Rovas-hyperlink stubs (§8c, §9)
7. Slovak primary / English secondary i18n strategy approved (§3 Language strategy)
8. 6-screen IA reviewed and signed off (initial mockup; superseded by Expo app)
9. Split-claims approved (§7): scanner is always included; default equal share with override; client-side recipient memory with optional "vždy zdieľať"; atomic multi-beneficiary claim; per-recipient + per-(scanner → recipient) monthly Merit caps

---

## Summary

| Layer | Technology | Location |
|-------|------------|----------|
| Mobile | Expo + expo-auth-session | `civic/apps/mobile` |
| Backend | Node + TS API | `civic/services/api` |
| Shared | Types + Merit math | `civic/packages/shared` |
| Identity | oauth2_server + rovas_oauth | `rovas` repo |
| Citizen ID (post-v1) | ÚPVS / slovensko.sk SP attach | Civic API (+ optional Slovensko.Digital proxy); see §16 |
| Ledger | Rovas Rules + Merits | `rovas` repo |

**Next step after approval:** Phase 0 spikes, then scaffold the **civic** monorepo.
