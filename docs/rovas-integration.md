# Civic ↔ Rovas OAuth (Expo + API)

**Rovas-side work (APIs to build, OAuth Services, claim rule):**  
`~/Documents/homeProjects/rovas/docs/integration/civic.md` — that file is the
source of truth for agents in the **rovas** repo. Do not send them here first.

**Standing rule for Civic agents:** whenever Civic needs something built or
changed on Rovas, write a task under
`rovas/docs/integration/civic_tasks/active/` and link it from that repo’s
`civic.md` Task directory. **Do not implement Rovas Drupal/PHP from Civic** —
that is the Rovas agent’s job. Do not leave Rovas tasks only in chat.

**Deferred (Rovas, not scheduled):** Trusted User via Slovak government ID
(slovensko.sk / eID) — design lives in Rovas
[`docs/trusted-user-eid.md`](../../rovas/docs/trusted-user-eid.md). Civic would
only consume `/rovas/me` flags after that ships; do not invent Expo UI until the
Rovas task is opened.

This document is the **Civic-side** companion (Expo login + Civic API Bearer).

**Gifts path framing:** user-facing copy is **Gifts** / **Dary** (verified
public-benefit / nonprofit orgs). Wire ids stay `charity` / `is_charity` /
`/charities/…`. Rovas UI labels still to update — see Rovas
**Next work: broaden Gifts path labels (public-benefit orgs)** in
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../../rovas/docs/integration/civic.md).

**Product copy (Merits-first):** Civic screens emphasize Merits as a
non-transferable record of contribution (About screen, Earn explainers). Rovas
is named on login and About. Chron reward choice is **opt-in** on Profile
(`civic.prefs.allow_chrons`); volunteer reports default to Merits only.
Receipt scanning-history retention (`keep` vs 90-day `policy`) is asked before
the first claim (and whenever unset) and editable under Profile **Taxes
settings**; stored on Rovas — see **[receipt-history-retention](../../rovas/docs/integration/civic_tasks/done/receipt-history-retention.md)**.
Primary auth is native Google/Apple (see [Expo client](#expo-client-native-google--apple)
below). Browser HybridAuth remains a legacy fallback.

**Legal / glossary URLs (mobile):** `apps/mobile/lib/legal-urls.ts` defaults to
`https://rovas.app/privacy` and `https://rovas.app/rules`. Overrides:
`EXPO_PUBLIC_LEGAL_PRIVACY_URL`, `EXPO_PUBLIC_LEGAL_TERMS_URL`,
`EXPO_PUBLIC_LEGAL_GLOSSARY_URL`. NeoFund drafts to publish and then flip those
URLs: `~/Documents/Business/NeoFund_NP/privacy-policy.md`,
`glossary.md`, `about-us.md`. Until then, live Rovas pages remain the interim
source.

**Service status:** About → Status calls Civic `GET /health`, which probes Rovas
(`civic_national_hourly_rate`) and returns `{ civic_api, rovas }` for the Status
screen.
## Expo client (native Google + Apple)

**Primary path:** native Google / Apple Sign-In in the Expo app → Civic API
verifies the IdP token → Rovas
[`civic-native-auth-bridge`](../../rovas/docs/integration/civic_tasks/done/civic-native-auth-bridge.md)
(`POST /rovas/civic_auth_session`) creates/links the Drupal user and **mints**
Civic OAuth Bearer tokens. Users do not open Rovas `/user/login` for the happy
path.

| Step | Detail |
|------|--------|
| Google | `@react-native-google-signin/google-signin` → `id_token` → `POST {API}/auth/google` |
| Apple (iOS) | `expo-apple-authentication` → `identity_token` → `POST {API}/auth/apple` |
| Refresh | `{ROVAS}/oauth2/token` (refresh_token grant) — unchanged |
| Revoke | `{ROVAS}/oauth2/revoke` — unchanged |
| Scope | `user_profile` |
| Client ID | `civic` (public) |

Mobile env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (see `apps/mobile/.env.example`).
API env: `ROVAS_API_KEY`, `ROVAS_TOKEN`, `GOOGLE_CLIENT_IDS`,
`APPLE_CLIENT_IDS` (see root `.env.example`).

Tokens live in `expo-secure-store`. Access tokens expire after **1 hour**; the
app silently refreshes using the refresh token (~14 days) and re-checks when
the app returns to the foreground.

**Legacy fallback:** Authorization Code + PKCE via system browser
(`{ROVAS}/oauth2/authorize` → `civic://oauth/callback`) remains in
`AuthProvider.signIn` but is not the primary AuthForm UI.

**Phase 2 (not in this ship):** email/password on the same mint path
(`provider=email` or sibling login/register). Facebook later: same bridge with
`provider=facebook`.

**Dev requirement:** native Google/Apple need a development build (not Expo
Go). Day-to-day device session steps are in the root
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
| `GET /me` | Proxies Rovas `/rovas/me` → `{ rovas_uid, username, display_name, total_me, total_chr?, created?, language?, receipt_history_retention?, me_sources_share?, trusted_user?, trusted_notify?, client_id, scope, expires_at }`. `total_chr` (Chron wallet) for Profil — see Rovas **Next work: Chron balance on /rovas/me**. `created` (ISO-8601 account registration) is required for Civic fraud rule C — see Rovas **Next work: expose account created on /rovas/me**. `language` (Drupal preferred langcode) drives signed-in UI locale — see Rovas **Next work: expose preferred language on /rovas/me**. `receipt_history_retention` (`null` \| `"keep"` \| `"policy"`) gates receipt claim + Profile Taxes settings — see Rovas **[receipt-history-retention](../../rovas/docs/integration/civic_tasks/done/receipt-history-retention.md)**. `me_sources_share` (`everyone` \| `reciprocal` \| `aggregate`, default `everyone`) — who may see Taxes vs Gifts detail; see Rovas **[me-sources-privacy](../../rovas/docs/integration/civic_tasks/active/me-sources-privacy.md)**. `trusted_user` + `trusted_notify` (`0`\|`1`\|`2`) drive the Trusted congratulations banner — see Rovas **[trusted-user-notify](../../rovas/docs/integration/civic_tasks/active/trusted-user-notify.md)**. |
| `POST /me/dismiss-trusted-notify` | Empty JSON body → Rovas `POST /rovas/civic_dismiss_trusted_notify`. Returns `{ trusted_user, trusted_notify }`. Permanently dismisses the Trusted congratulations banner (same `field_trusted_notify = 2` as Rovas web). See Rovas **[trusted-user-notify](../../rovas/docs/integration/civic_tasks/active/trusted-user-notify.md)**. |
| `POST /me/receipt-history-preference` | Body `{ retention: "keep" \| "policy" }` → Rovas `POST /rovas/civic_receipt_history_preference`. Returns `{ receipt_history_retention, scrubbed_claims }`. Keep→policy may scrub aged merchant/purchase detail (irreversible). Survives app reinstall. See Rovas **receipt-history-retention**. |
| `POST /me/me-sources-preference` | Body `{ share: "everyone" \| "reciprocal" \| "aggregate" }` → Rovas `POST /rovas/civic_me_sources_preference`. Returns `{ me_sources_share }`. Controls whether other users see detailed ME sources or Taxes+Gifts aggregate. See Rovas **[me-sources-privacy](../../rovas/docs/integration/civic_tasks/active/me-sources-privacy.md)**. |
| `POST /me/give-chrons` | Body `{ amount }` (positive Chrons) → Rovas `POST /rovas/civic_give_chrons`. Returns `{ chrons_given, merits_gained, total_chr, total_me }` (1:1 CHR→ME). Get Merits → Volunteering “Give Chrons” when `total_chr > 0`. See Rovas **[give-chrons-to-merits](../../rovas/docs/integration/civic_tasks/done/give-chrons-to-merits.md)**. |
| `POST /me/profile` | Body `{ username?, display_name? }` (at least one) → Rovas `POST /rovas/civic_update_profile`. Returns `{ username, display_name }`. Profile **User profile** tab (change auto-generated username / optional real name). See Rovas **[update-profile](../../rovas/docs/integration/civic_tasks/active/update-profile.md)**. |
| `GET /me/contributions/summary` | `total_me` from Rovas wallet; `by_category.taxes` + receipt stats from Rovas claim summary once live (interim: zeros — see Rovas task **Civic claim reads + SoT**) |
| `POST /receipts/claim` | Re-verify FS + Civic fraud checks (strikes, window, registration, same-store, min VAT, rate limits); UID dedup + Merits via Rovas `rules_proxy_claim_vat_receipt` (optional `shares[]`; optional `location`). Rovas `{civic_claims}` is sole claim registry |
| `GET /receipts` | Claim history — proxies Rovas `GET /rovas/civic_claims?view=submitted\|received&limit=&offset=` (+ optional `merchant`, `date_from`, `date_to`, `min_vat_eur`, `max_vat_eur`). Filters before pagination; `total` is filtered count. VAT bounds apply to `submitted` only. See Rovas **[civic-claims-filters](../../rovas/docs/integration/civic_tasks/active/civic-claims-filters.md)**. |
| `GET /users/search` | Split-claim typeahead — proxies Rovas `GET /rovas/users_search?query=` (Civic accepts `?q=`; maps to Rovas `query` because Drupal reserves `$_GET['q']` for the path) |
| `GET /users/lookup` | Community public profile — proxies Rovas `GET /rovas/users_lookup?username=&lang=` (Bearer; exact username). Optional `lang=sk|en` for translated project `name`s — see Rovas **Next work: localized project and work-report text**. Returns `UserLookup` (`total_me`, `by_category`, `nace_expertise[]`, tax months, top charity/volunteer, `member_since_year`, `me_sources_detail`). When `me_sources_detail` is `aggregate`, Taxes+Gifts are merged (`taxes_and_gifts`; tax/gift drill-downs empty) — see Rovas **[me-sources-privacy](../../rovas/docs/integration/civic_tasks/active/me-sources-privacy.md)**. `member_since_year` (int, account creation year) is shown next to `@username` on Home and Community profile — see Rovas **Next work: member_since_year on users_lookup**. When Rovas sends `by_source` and detail is not aggregate, Civic remaps into `by_category` (`tax_payment`→taxes, `charitable_donation`→charity, `volunteer_work`+`volunteer`→volunteer; `penalty` split across non-zero buckets proportionally — see Rovas **[penalty-proportional-by-category](../../rovas/docs/integration/civic_tasks/done/penalty-proportional-by-category.md)**). NACE expertise icons (Merit Index) — see Rovas **Next work: NACE expertise on users_lookup**. **`top_volunteer_projects`:** co_worker allocations + WR-linked ledger ME — see Rovas **Next work: top_volunteer_projects include WR rewards**. **Gifts list (`top_charities`):** Path-1 + buy-ME + timeshare — see Rovas **[gifts-top-charities-attribution](../../rovas/docs/integration/civic_tasks/done/gifts-top-charities-attribution.md)**. When **penalty** shrinks a category below gross `top_*` rows, Civic **`capProjectRowsToCategory`** scales displayed project ME to the tab. Percentile is computed on Civic from `/rank/distribution`. Friend invite on Komunita is client `mailto:` only (no Rovas invite API). |
| `GET /users/me/merit-history` | Signed-in Merit ledger for Profil — proxies Rovas `GET /rovas/civic_merit_history?limit=&offset=&lang=` (Bearer). Same rows as Views `merit_history` / `page_1` (`/user/%/merits`). Rovas **live** — see **merit history (profile ledger)**. |
| `GET /rank/index` | Merit Index leaderboard for Prínos / ME•ter — proxies Rovas `GET /rovas/civic_merit_index` (lifetime), or `GET /rovas/civic_merit_period_index` when `?period=day\|week\|month` is set. Optional Bearer; public read on Rovas. See Rovas **Next work: Merit period index (ME•ter time dimension)**. When items include `by_source`, Civic remaps ME-source bars the same way as users_lookup (see Rovas **Next work: by_source on merit index**). Filtered first-page lifetime latency — see Rovas **Next work: merit index filter latency**. |
| `GET /rank/spotlight` | Merit spotlight (period leads by area) — proxies Rovas `GET /rovas/civic_merit_spotlight?period=&country_iso2=`. `period`: `today`\|`day`\|`week`\|`month` (`today` = current Bratislava calendar day). Optional Bearer adds `you`. Home **ticker** uses `period=today` (`community_earned_me` + `active_earners`). On Rovas 404, Civic returns an empty payload (200). See Rovas **[merit-spotlight-today](../../rovas/docs/integration/civic_tasks/active/merit-spotlight-today.md)**. |
| `GET /rank/index/countries` | Merit Index country dropdown — proxies Rovas `GET /rovas/civic_merit_index_countries`. Optional Bearer; public read on Rovas. |
| `GET /projects/mine` | Volunteer form — proxies Rovas `GET /rovas/civic_my_projects?lang=` (Bearer). Up to **3** projects where the user filed work reports most recently; empty if none. Search/create for others. See Rovas **volunteer report (Civic deferred form)**. |
| `GET /projects/search` | Volunteer typeahead — proxies Rovas `GET /rovas/civic_projects_search?query=` (Civic `?q=`; maps to Rovas `query`). |
| `POST /projects` | Create project — proxies Rovas `POST /rovas/civic_create_project` (`name`, `description`, optional `url`). Defaults on Rovas: status for sale, Public. |
| `GET /nace` | NACE drill-down tree — proxies Rovas `GET /rovas/civic_nace_tree?lang=`. Optional Bearer; public read on Rovas (volunteer form still sends Bearer when signed in). |
| `POST /nace/classify` | AI NACE from work description — proxies Rovas `POST /rovas/civic_ai_nace` (see Rovas **AI NACE + title**). Returns `status`: `ok` \| `need_more_info` \| `unavailable` \| `error`. Manual NACE tree remains fallback. |
| `GET /work-reports/map-config` | Map proof widget — proxies Rovas `GET /rovas/civic_work_report_map_config` (basemap tiles, centre, allowed geometry types). Civic serves an OSM fallback until Rovas ships the endpoint. |
| `GET /work-reports/fee-info` | Volunteer form disclosure — Civic env only (`WR_USAGE_FEE_*`, `CIVIC_APP_PROJECT_NID`). Returns `{ enabled, wr_usage_fee_rate, rovas_platform_fee_rate }`. No Rovas call. |
| `GET /work-reports/:nid` | Verify screen — proxies Rovas `GET /rovas/civic_work_report/{nid}?lang=` (extended WR + verification context). See Rovas **Next work: Civic WR verification (in-app)**. |
| `POST /work-reports` | Submit volunteer report — proxies Rovas `POST /rovas/civic_create_work_report` (hours, date, description, NACE, proof URL and/or photos and/or `field_location` GeoJSON, `reward_kind`). Expo paints blackouts onto proof photos **before** upload (`photos[]` as sent; `photo_redact_mode` ignored) — see Rovas **[proof-photo-redact](../../rovas/docs/integration/civic_tasks/done/proof-photo-redact.md)**. Map proof may be Point / LineString / Polygon or a mixed **`GeometryCollection`** (≥2 features) — see Rovas **[work-report-geometry-collection](../../rovas/docs/integration/civic_tasks/done/work-report-geometry-collection.md)**. Civic rejects `date_started` more than **30** Bratislava calendar days before today (`date_reporting_window_expired`) before calling Rovas. When `WR_USAGE_FEE_ENABLED` and `CIVIC_APP_PROJECT_NID` are set, Civic attaches `usage_fee_project_id` + `usage_fee_rate` for a deferred app AUR on approval. See Rovas **Next work: Civic WR usage fee (app AUR)**. |
| `GET /verifications/pending` | In-app verification notifications — proxies Rovas `GET /rovas/civic_pending_verifications?lang=`. |
| `POST /verifications/:slot_nid` | Submit verdict — proxies Rovas `POST /rovas/civic_submit_verification` (`verdict`, optional `verified_hours`, `note`). |
| `GET /comment-notices/pending` | In-app watched-comment notifications — proxies Rovas `GET /rovas/civic_pending_comment_notices`. Links open Rovas `comment_url` until in-Civic comments exist. See Rovas **[pending-comment-notices](../../rovas/docs/integration/civic_tasks/active/pending-comment-notices.md)**. |
| `POST /push-tokens` | Register Expo push token for OS notifications (Phase 4). Body: `expo_push_token`, `platform` (`ios` \| `android`). |
| `DELETE /push-tokens` | Remove push token(s) on logout. Optional body `expo_push_token`; omit to clear all for user. |
| `POST /charities/organizations` | Bearer — donor adds a public-benefit / nonprofit org. Proxies Rovas `POST /rovas/civic_create_charity_org` (`name`, `country`, `website_url`, `contact_email`, `org_id`, `iban`). Response `{ ok, status: approved\|pending, created, organization_nid, project_nid, organization, ownership }`. See Rovas **[donor-add-charity-org](../../rovas/docs/integration/civic_tasks/done/donor-add-charity-org.md)**. |

`POST /receipts/verify` sends optional Bearer; when present, Civic checks
`GET /rovas/civic_claims?receipt_uid=` and returns `already_claimed` so the
app can lock split UI + claim before submit. |

Optional Bearer:

| Route | Notes |
|-------|--------|
| `GET /rank/distribution` | Proxies Rovas `/rovas/merit_distribution`; with auth includes `user_bucket_index`, `username`, `user_merits` |
| `GET /rank/index` | Merit Index leaderboard — proxies Rovas `GET /rovas/civic_merit_index` (no Bearer required) |
| `GET /rank/spotlight` | Period Merit spotlight — proxies Rovas `GET /rovas/civic_merit_spotlight` (`today`\|`day`\|`week`\|`month`; no Bearer required; Bearer adds `you`) |
| `GET /rank/index/countries` | Merit Index country filter — proxies Rovas `GET /rovas/civic_merit_index_countries` (no Bearer required) |
| `GET /nace` | NACE tree for Prínos filters — proxies Rovas `GET /rovas/civic_nace_tree` (no Bearer required) |
| `GET /projects/:nid` | Project detail / Nonprofit expand — proxies Rovas `GET /rovas/civic_project/{nid}?lang=`. Anonymous allowed for NeoFund-**approved** public-benefit / nonprofit projects (`is_charity` + approved org); other projects need Bearer. Gift-path fields (wire names): `is_charity`, `charity_status`, `organization`, `donate_instructions`, `donate_url`, `donate_iban` (compact IBAN whenever stored), `iban_verified` (staff gate for Pay by Square), plus `org_id`, `country` (ISO2), `website_url` for Basic info — see Rovas **[charity-org-basic-info](../../rovas/docs/integration/civic_tasks/active/charity-org-basic-info.md)** (supersedes verified-only IBAN rule in **[gift-donate-iban](../../rovas/docs/integration/civic_tasks/done/gift-donate-iban.md)**). Also: **Next work: charitable projects (Civic catalog)** and **Next work: broaden Gifts path labels (public-benefit orgs)**. |
| `GET /projects/:nid/work-reports` | Paginated work ledgers — same anonymous rule as project detail |
| `GET /projects/:nid/shareholders` | Paginated shareholders — same anonymous rule as project detail |

Public:

| Route | Notes |
|-------|--------|
| `GET /community/contributions/summary` | Proxies Rovas `/rovas/contributions/aggregate` |
| `GET /merit-rate` | National hourly wage for ME↔€ / claim preview — proxies Rovas `GET /rovas/civic_national_hourly_rate` (falls back to `HOURLY_WAGE_EUR` if unreachable) |
| `GET /charities/projects` | Gifts / nonprofit catalog — proxies Rovas `GET /rovas/civic_charity_projects` when `type=charity` (`query`, `limit`, `lang`). Envelope `{ total, projects[] }`. Invest stubs remain static (`type=invest`). Wire path/type stay `charities` / `charity`. See Rovas **Next work: charitable projects (Civic catalog)** and **Next work: broaden Gifts path labels (public-benefit orgs)**. |

**Smoke (after Rovas [donor-add-charity-org](../../rovas/docs/integration/civic_tasks/done/donor-add-charity-org.md) is live on rovdev):**

1. Signed-in Civic user submits Add organisation with a known SK IČO from the nonprofit register → `status: approved`, org appears in `GET /charities/projects`, catalog card expands in place.
2. Non-SK country (or unknown IČO) → `status: pending`; under-review alert; org absent from catalog until staff approve.
3. Resubmit same `(country, org_id)` → `created: false`, same nids; approved duplicate expands in list; pending duplicate shows under-review again.
4. Contact email matching the Bearer user’s Drupal mail → `ownership: "submitter"`; otherwise `ownership: "custodial"`.
5. Verify button next to contact email → stub modal only (no API yet).

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
| Rank histogram | `/rank/distribution` | `GET /rovas/merit_distribution` — decade edges `0,1,10,100,…` (`bin_edges_log10` starts at `-20`); see **[merit-distribution-decade-bins](../../rovas/docs/integration/civic_tasks/done/merit-distribution-decade-bins.md)** |
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

## Watched-comment notices (in-app)

Same banner pattern as verification notices (header under the nav bar). Polls
`GET /comment-notices/pending` (Rovas `GET /rovas/civic_pending_comment_notices`
— see **[pending-comment-notices](../../rovas/docs/integration/civic_tasks/active/pending-comment-notices.md)**).
Each row opens the Rovas `comment_url` in the system browser for now; rewire to
in-Civic comment UI when reports show comments in-app.

**Requires on rovdev:** `rovas_comment_watch` enabled + `drush74 updb` (`7028`)
so the resource returns notices (empty `{ total: 0, items: [] }` if the module
is off).

## Trusted user congratulations (in-app)

Header banner (above verification / comment notices) when `GET /me` returns
`trusted_user: true` and `trusted_notify: 1`. Dismiss via
`POST /me/dismiss-trusted-notify` (same permanent `field_trusted_notify = 2` as
Rovas web — not session-only). Settings CTA opens Rovas account edit
`#edit-trusted-user-settings` until in-app Trusted prefs exist. Polls `/me`
while signed in (same cadence as other header notices).

**Requires on rovdev:**
**[trusted-user-notify](../../rovas/docs/integration/civic_tasks/active/trusted-user-notify.md)**
(`7031` — `/rovas/me` fields + `POST /rovas/civic_dismiss_trusted_notify`).
Until deployed, `/me` omits the fields and Civic treats notify as `0` (no banner).
Independent of deferred eID Trusted eligibility.

## Civic WR usage fee (app AUR)

When a work report filed through Civic is approved (peer verification, or
immediate approval for a **Trusted user** with auto-approve), Rovas takes its
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
claim table. History search filters (`merchant`, `date_from`/`date_to`,
`min_vat_eur`/`max_vat_eur` on submitted) are specified in Rovas
**[civic-claims-filters](../../rovas/docs/integration/civic_tasks/active/civic-claims-filters.md)**
(no gross total or line-item search — those fields are not stored).

**Dev reset:** clear Rovas claims (see Rovas `docs/integration/civic.md`);
optionally truncate Civic `claim_attempts`.

## Receipt claim (solo + split)

Civic `POST /receipts/claim` (Bearer required) re-verifies the eKasa receipt,
runs Civic fraud checks, then calls Rovas (which owns dedup + persist):

`POST {ROVAS}/rovas/rules/rules_proxy_claim_vat_receipt`

Body may include `shares: [{ rovas_uid, share_pct }]` (scanner must be
included with `share_pct > 0`; percentages sum to ~100). Omitted → 100% to
caller. Optional burn share: reserved sentinel `rovas_uid: "anonymous"` (at
most one) — that VAT slice issues **no Merits**; Rovas persists the share at
0 ME. Contract:
**[claim-anonymous-burn-share](../../rovas/docs/integration/civic_tasks/done/claim-anonymous-burn-share.md)**.

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
Multi/mixed features: Rovas **[work-report-geometry-collection](../../rovas/docs/integration/civic_tasks/done/work-report-geometry-collection.md)**.
**Next work:**
[pending verifications gate (assigned slots only)](~/Documents/homeProjects/rovas/docs/integration/civic.md#next-work-pending-verifications-gate-assigned-slots-only)
— empty obligation slots must not block new reports.
**Next work:**
[Civic WR verification (in-app)](~/Documents/homeProjects/rovas/docs/integration/civic.md#next-work-civic-wr-verification-in-app)
— pending list, WR detail, submit verdict (Civic client ready; blocked until rovdev).
