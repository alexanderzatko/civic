# Civic ↔ Rovas OAuth (Expo + API)

**Rovas-side work (APIs to build, OAuth Services, claim rule):**  
`~/Documents/homeProjects/rovas/docs/integration/civic.md` — that file is the
source of truth for agents in the **rovas** repo. Do not send them here first.

**Standing rule for Civic agents:** whenever Civic needs something built or
changed on Rovas, describe that work in the Rovas doc above (a **Next work:**
section with checklist + smoke test). Do not leave Rovas tasks only in chat —
Rovas agents read that file, not this conversation.

This document is the **Civic-side** companion (Expo login + Civic API Bearer).

**Gifts path framing:** user-facing copy is **Gifts** / **Dary** (verified
public-benefit / nonprofit orgs). Wire ids stay `charity` / `is_charity` /
`/charities/…`. Rovas UI labels still to update — see Rovas
**Next work: broaden Gifts path labels (public-benefit orgs)** in
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../../rovas/docs/integration/civic.md).

## Expo client

| Setting | Value |
|---------|--------|
| Authorize | `{ROVAS}/oauth2/authorize` |
| Token | `{ROVAS}/oauth2/token` |
| Revoke | `{ROVAS}/oauth2/revoke` |
| Client ID | `civic` (public, no secret) |
| Redirect | `civic://oauth/callback` |
| Scope | `user_profile` |
| PKCE | S256 (required) |

Config via `EXPO_PUBLIC_ROVAS_BASE_URL` / `EXPO_PUBLIC_ROVAS_OAUTH_CLIENT_ID`
(see `apps/mobile/.env` and root `.env.example`).

Tokens live in `expo-secure-store`. `AuthProvider` runs Authorization Code +
PKCE via `expo-auth-session`. Access tokens expire after **1 hour**; the app
silently refreshes using the refresh token (14-day lifetime) and re-checks when
the app returns to the foreground. Login/register provider buttons all open the
same Rovas authorize URL; Google / Facebook / Drupal login is chosen on the
Rovas HybridAuth page.

Rovas **Next work: OAuth session persistence (refresh token rotation)** must be
deployed on `dev.rovas.app` so refresh returns a replacement token.

**Dev requirement:** custom scheme `civic://` needs a development build
(`pnpm --filter @civic/mobile ios:device`), not Expo Go. Day-to-day
device session steps (API + Metro tunnel) are in the root
[`README.md`](../README.md) under **Physical iPhone**.

## Civic API Bearer validation

Civic API introspects the mobile access token with:

```http
GET {ROVAS_BASE_URL}/oauth2/tokens/{access_token}
Accept: application/json
```

Valid response includes `user_id` (Drupal uid), `client_id`, `expires`,
`scope`. Invalid/expired → 404 from Rovas → Civic returns **401**.

Protected routes (send `Authorization: Bearer <access_token>`):

| Route | Notes |
|-------|--------|
| `GET /me` | Proxies Rovas `/rovas/me` → `{ rovas_uid, username, display_name, total_me, total_chr?, created?, language?, client_id, scope, expires_at }`. `total_chr` (Chron wallet) for Profil — see Rovas **Next work: Chron balance on /rovas/me**. `created` (ISO-8601 account registration) is required for Civic fraud rule C — see Rovas **Next work: expose account created on /rovas/me**. `language` (Drupal preferred langcode) drives signed-in UI locale — see Rovas **Next work: expose preferred language on /rovas/me**. |
| `GET /me/contributions/summary` | `total_me` from Rovas wallet; `by_category.taxes` + receipt stats from Rovas claim summary once live (interim: zeros — see Rovas task **Civic claim reads + SoT**) |
| `POST /receipts/claim` | Re-verify FS + Civic fraud checks (strikes, window, registration, same-store, min VAT, rate limits); UID dedup + Merits via Rovas `rules_proxy_claim_vat_receipt` (optional `shares[]`; optional `location`). Rovas `{civic_claims}` is sole claim registry |
| `GET /users/search` | Split-claim typeahead — proxies Rovas `GET /rovas/users_search?query=` (Civic accepts `?q=`; maps to Rovas `query` because Drupal reserves `$_GET['q']` for the path) |
| `GET /users/lookup` | Community public profile — proxies Rovas `GET /rovas/users_lookup?username=&lang=` (Bearer; exact username). Optional `lang=sk|en` for translated project `name`s — see Rovas **Next work: localized project and work-report text**. Returns `UserLookup` (`total_me`, `by_category`, `nace_expertise[]`, tax months, top charity/volunteer, `member_since_year`). `member_since_year` (int, account creation year) is shown next to `@username` on Home and Community profile — see Rovas **Next work: member_since_year on users_lookup**. When Rovas sends `by_source`, Civic remaps into `by_category` (`tax_payment`→taxes, `charitable_donation`→charity, `volunteer_work`+`volunteer`+`penalty`→volunteer). NACE expertise icons (Merit Index) — see Rovas **Next work: NACE expertise on users_lookup**. **`top_volunteer_projects`:** co_worker allocations + WR-linked ledger ME — see Rovas **Next work: top_volunteer_projects include WR rewards**. Tab totals come from ledger `by_source`; if Volunteer tab under-counts vs project list, see Rovas **Next work: co_worker %-shares misclassified as charity** (0h co_worker must be `volunteer_work`, not charity). CHR→ME stays unattributed. Percentile is computed on Civic from `/rank/distribution`. Friend invite on Komunita is client `mailto:` only (no Rovas invite API). |
| `GET /users/me/merit-history` | Signed-in Merit ledger for Profil — proxies Rovas `GET /rovas/civic_merit_history?limit=&offset=&lang=` (Bearer). Same rows as Views `merit_history` / `page_1` (`/user/%/merits`). Rovas **live** — see **merit history (profile ledger)**. |
| `GET /rank/index` | Merit Index leaderboard for Prínos / ME•ter — proxies Rovas `GET /rovas/civic_merit_index` (lifetime), or `GET /rovas/civic_merit_period_index` when `?period=day\|week\|month` is set. Optional Bearer; public read on Rovas. See Rovas **Next work: Merit period index (ME•ter time dimension)**. When items include `by_source`, Civic remaps ME-source bars the same way as users_lookup (see Rovas **Next work: by_source on merit index**). Filtered first-page lifetime latency — see Rovas **Next work: merit index filter latency**. |
| `GET /rank/spotlight` | Merit spotlight (period leads by area) — proxies Rovas `GET /rovas/civic_merit_spotlight?period=&country_iso2=`. Optional Bearer adds `you`. Used on **Home** only. On Rovas 404, Civic returns an empty payload (200). See Rovas **Next work: Merit spotlight (period leads by area)**. |
| `GET /rank/index/countries` | Merit Index country dropdown — proxies Rovas `GET /rovas/civic_merit_index_countries`. Optional Bearer; public read on Rovas. |
| `GET /projects/mine` | Volunteer form — proxies Rovas `GET /rovas/civic_my_projects?lang=` (Bearer). Up to **3** projects where the user filed work reports most recently; empty if none. Search/create for others. See Rovas **volunteer report (Civic deferred form)**. |
| `GET /projects/search` | Volunteer typeahead — proxies Rovas `GET /rovas/civic_projects_search?query=` (Civic `?q=`; maps to Rovas `query`). |
| `POST /projects` | Create project — proxies Rovas `POST /rovas/civic_create_project` (`name`, `description`, optional `url`). Defaults on Rovas: status for sale, Public. |
| `GET /nace` | NACE drill-down tree — proxies Rovas `GET /rovas/civic_nace_tree?lang=`. Optional Bearer; public read on Rovas (volunteer form still sends Bearer when signed in). |
| `POST /nace/classify` | AI NACE from work description — proxies Rovas `POST /rovas/civic_ai_nace` (see Rovas **AI NACE + title**). Returns `status`: `ok` \| `need_more_info` \| `unavailable` \| `error`. Manual NACE tree remains fallback. |
| `GET /work-reports/map-config` | Map proof widget — proxies Rovas `GET /rovas/civic_work_report_map_config` (basemap tiles, centre, allowed geometry types). Civic serves an OSM fallback until Rovas ships the endpoint. |
| `GET /work-reports/fee-info` | Volunteer form disclosure — Civic env only (`WR_USAGE_FEE_*`, `CIVIC_APP_PROJECT_NID`). Returns `{ enabled, wr_usage_fee_rate, rovas_platform_fee_rate }`. No Rovas call. |
| `GET /work-reports/:nid` | Verify screen — proxies Rovas `GET /rovas/civic_work_report/{nid}?lang=` (extended WR + verification context). See Rovas **Next work: Civic WR verification (in-app)**. |
| `POST /work-reports` | Submit volunteer report — proxies Rovas `POST /rovas/civic_create_work_report` (hours, date, description, NACE, proof URL and/or photos and/or `field_location` GeoJSON, `reward_kind`). When `WR_USAGE_FEE_ENABLED` and `CIVIC_APP_PROJECT_NID` are set, Civic attaches `usage_fee_project_id` + `usage_fee_rate` for a deferred app AUR on approval. See Rovas **Next work: Civic WR usage fee (app AUR)**. |
| `GET /verifications/pending` | In-app verification notifications — proxies Rovas `GET /rovas/civic_pending_verifications?lang=`. |
| `POST /verifications/:slot_nid` | Submit verdict — proxies Rovas `POST /rovas/civic_submit_verification` (`verdict`, optional `verified_hours`, `note`). |
| `POST /push-tokens` | Register Expo push token for OS notifications (Phase 4). Body: `expo_push_token`, `platform` (`ios` \| `android`). |
| `DELETE /push-tokens` | Remove push token(s) on logout. Optional body `expo_push_token`; omit to clear all for user. |

`POST /receipts/verify` sends optional Bearer; when present, Civic checks
`GET /rovas/civic_claims?receipt_uid=` and returns `already_claimed` so the
app can lock split UI + claim before submit. |

Optional Bearer:

| Route | Notes |
|-------|--------|
| `GET /rank/distribution` | Proxies Rovas `/rovas/merit_distribution`; with auth includes `user_bucket_index`, `username`, `user_merits` |
| `GET /rank/index` | Merit Index leaderboard — proxies Rovas `GET /rovas/civic_merit_index` (no Bearer required) |
| `GET /rank/spotlight` | Period Merit spotlight — proxies Rovas `GET /rovas/civic_merit_spotlight` (no Bearer required; Bearer adds `you`) |
| `GET /rank/index/countries` | Merit Index country filter — proxies Rovas `GET /rovas/civic_merit_index_countries` (no Bearer required) |
| `GET /nace` | NACE tree for Prínos filters — proxies Rovas `GET /rovas/civic_nace_tree` (no Bearer required) |
| `GET /projects/:nid` | Project detail modal — proxies Rovas `GET /rovas/civic_project/{nid}?lang=`. Anonymous allowed for NeoFund-**approved** public-benefit / nonprofit projects (`is_charity` + approved org); other projects need Bearer. Gift-path fields (wire names): `is_charity`, `charity_status`, `organization`, `donate_instructions`, `donate_url`. See Rovas **Next work: charitable projects (Civic catalog)** and **Next work: broaden Gifts path labels (public-benefit orgs)**. |
| `GET /projects/:nid/work-reports` | Paginated work ledgers — same anonymous rule as project detail |
| `GET /projects/:nid/shareholders` | Paginated shareholders — same anonymous rule as project detail |

Public:

| Route | Notes |
|-------|--------|
| `GET /community/contributions/summary` | Proxies Rovas `/rovas/contributions/aggregate` |
| `GET /merit-rate` | National hourly wage for ME↔€ / claim preview — proxies Rovas `GET /rovas/civic_national_hourly_rate` (falls back to `HOURLY_WAGE_EUR` if unreachable) |
| `GET /charities/projects` | Gifts / nonprofit catalog — proxies Rovas `GET /rovas/civic_charity_projects` when `type=charity` (`query`, `limit`, `lang`). Envelope `{ total, projects[] }`. Invest stubs remain static (`type=invest`). Wire path/type stay `charities` / `charity`. See Rovas **Next work: charitable projects (Civic catalog)** and **Next work: broaden Gifts path labels (public-benefit orgs)**. |

`ROVAS_BASE_URL` is read from the API `.env` (default `https://dev.rovas.app`).

## Merit conversion wage

Rovas admin **national hourly rate** is the SoT for VAT→ME math (and Civic
previews once the public read API exists). See Rovas task
**Next work: public national hourly rate API** in
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../../rovas/docs/integration/civic.md).

Until that endpoint is enabled on rovdev, Civic API uses env/settings
fallback (`HOURLY_WAGE_EUR`, default 7.5).

## Home screen data (wired)

| Home need (mockup) | Civic API | Rovas source |
|--------------------|-----------|--------------|
| Personal ME total | `/me/contributions/summary` → `total_me` | `GET /rovas/me` |
| Personal username | `/me` / summary `username` | `GET /rovas/me` |
| Community total ME | `/community/contributions/summary` | `GET /rovas/contributions/aggregate` |
| Rank histogram | `/rank/distribution` | `GET /rovas/merit_distribution` |
| Merit spotlight | `/rank/spotlight` | `GET /rovas/civic_merit_spotlight` — see Rovas **Next work: Merit spotlight (period leads by area)** |
| € equivalent | `/merit-rate` → `hourly_wage_eur` | `GET /rovas/civic_national_hourly_rate` (fallback: Civic settings) |
| Category mix | taxes from Rovas claim summary (interim 0); charity/volunteer 0 | Aggregate `by_category` still zeros on Rovas |

**Refresh:** home re-fetches ME (+ rate/rank) on tab focus, when the app
returns to the foreground, every 5 minutes while focused, and immediately
after a successful receipt claim (`notifyMeritsChanged`).

Client: `services/api/src/rovas-client.ts`. Enable resources on rovdev via
**Enable Civic home API resources** (or `drush74 updb`) if a proxy returns 404.

## Work report verification (in-app)

Civic shows **in-app notification cards** (Home + volunteer submit gate) with
links to a per-report verify screen — no dedicated inbox list. Polls
`GET /verifications/pending`; verify screen loads `GET /work-reports/:nid` and
submits via `POST /verifications/:slot_nid`.

**Blocked on Rovas:** implement and deploy
[Next work: Civic WR verification (in-app)](../../rovas/docs/integration/civic.md#next-work-civic-wr-verification-in-app)
before verifier UX works end-to-end on rovdev.

**OS push (Phase 4):** mobile registers Expo tokens via `POST /push-tokens` after
sign-in. Server-side send + Rovas assignment webhook are documented in the Rovas
integration doc follow-up section.

## Civic WR usage fee (app AUR)

After two verifiers approve a work report filed through Civic, Rovas takes its
usual **1%** platform AUR, then (when enabled) an additional **Civic app fee**
(~3% of `hours × 10` Chrons) as a second AUR to the Civic project. Merits go to
that project’s shareholders. Reports filed on Rovas directly are unaffected.

**Config (Civic API env only — Rovas does not store Civic’s project nid):**

| Variable | Role |
|----------|------|
| `WR_USAGE_FEE_ENABLED` | Attach fee params on `POST /work-reports` |
| `WR_USAGE_FEE_RATE` | Fraction (default `0.03`) |
| `CIVIC_APP_PROJECT_NID` | Rovas project nid receiving the AUR |

**One-time ops:** create a “Civic” project in the Rovas UI (Merit allocation
100% to the NeoFund/ops owner), then set `CIVIC_APP_PROJECT_NID`.

**Rovas:** [Next work: Civic WR usage fee (app AUR)](../../rovas/docs/integration/civic.md#next-work-civic-wr-usage-fee-app-aur)
— stores fee params on create; charges on approval via `rules_create_aur`.

Form disclosure: `GET /work-reports/fee-info` + `volunteer.fee_notice` (EN/SK).

## Claim registry SoT

**Rovas** `{civic_claims}` / `{civic_claim_shares}` is the **only** claim
registry (`receipt_uid` UNIQUE, VAT, shares, Merits). Civic SQLite keeps
`claim_attempts` for fraud/ops (strikes, rate limits, same-store keys) — not a duplicate
claim table.

**Dev reset:** clear Rovas claims (see Rovas `docs/integration/civic.md`);
optionally truncate Civic `claim_attempts`.

## Receipt claim (solo + split)

Civic `POST /receipts/claim` (Bearer required) re-verifies the eKasa receipt,
runs Civic fraud checks, then calls Rovas (which owns dedup + persist):

`POST {ROVAS}/rovas/rules/rules_proxy_claim_vat_receipt`

Body may include `shares: [{ rovas_uid, share_pct }]` (scanner must be
included; percentages sum to ~100). Omitted → 100% to caller.

Split typeahead: Civic `GET /users/search?q=` → Rovas
`GET /rovas/users_search?query=` (param renamed from `q` — Drupal path
conflict). See Rovas **users search (split typeahead)**.

Community public profile: Civic `GET /users/lookup?username=` → Rovas
`GET /rovas/users_lookup?username=` (machine-name path; slash aliases 404).
See Rovas **users lookup (community public profile)**.

**Rovas agents:** claim rule checklist in
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../../rovas/docs/integration/civic.md)
→ **Next work: solo VAT claim**. Claim history/summary reads:
→ **Done: Civic claim reads + SoT** (Civic `GET /receipts`, summary). Received
history includes `scanner_username` + `scanner_display_name` (with
`scanner_rovas_uid`) for the From column — wire Expo after rovdev deploy.
National rate read: → **Next work: public national hourly rate API**. Users
search: → **Next work: users search (split typeahead)**. Users lookup
(Komunita): → **Next work: users lookup (community public profile)**.
Merit history (Profil): → **Done: merit history (profile ledger)** (`GET /rovas/civic_merit_history`).
Volunteer report (screen 4): → **Next work: volunteer report (Civic deferred form)**
(`GET /rovas/civic_my_projects`, `civic_projects_search`, `civic_nace_tree`,
`POST /rovas/civic_create_project`, `civic_create_work_report`). **Next work:**
[geofield on Civic work reports](~/Documents/homeProjects/rovas/docs/integration/civic.md#next-work-geofield-on-civic-work-reports)
— map proof (`GET /rovas/civic_work_report_map_config`, `field_location` on create).
**Next work:**
[pending verifications gate (assigned slots only)](~/Documents/homeProjects/rovas/docs/integration/civic.md#next-work-pending-verifications-gate-assigned-slots-only)
— empty obligation slots must not block new reports.
**Next work:**
[Civic WR verification (in-app)](~/Documents/homeProjects/rovas/docs/integration/civic.md#next-work-civic-wr-verification-in-app)
— pending list, WR detail, submit verdict (Civic client ready; blocked until rovdev).
