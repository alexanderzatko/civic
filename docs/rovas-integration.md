# Civic ↔ Rovas OAuth (Expo + API)

**Rovas-side work (APIs to build, OAuth Services, claim rule):**  
`~/Documents/homeProjects/rovas/docs/integration/civic.md` — that file is the
source of truth for agents in the **rovas** repo. Do not send them here first.

This document is the **Civic-side** companion (Expo login + Civic API Bearer).

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
PKCE via `expo-auth-session`. Login/register provider buttons all open the
same Rovas authorize URL; Google / Facebook / Drupal login is chosen on the
Rovas HybridAuth page.

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
| `GET /me` | Proxies Rovas `/rovas/me` → `{ rovas_uid, username, display_name, total_me, created?, client_id, scope, expires_at }`. `created` (ISO-8601 account registration) is required for Civic fraud rule C — see Rovas **Next work: expose account created on /rovas/me**. |
| `GET /me/contributions/summary` | `total_me` from Rovas wallet; `by_category.taxes` + receipt stats from Rovas claim summary once live (interim: zeros — see Rovas task **Civic claim reads + SoT**) |
| `POST /receipts/claim` | Re-verify FS + Civic fraud checks (strikes, window, registration, same-store, min VAT, rate limits); UID dedup + Merits via Rovas `rules_proxy_claim_vat_receipt` (optional `shares[]`; optional `location`). Rovas `{civic_claims}` is sole claim registry |
| `GET /users/search` | Split-claim typeahead — proxies Rovas `GET /rovas/users_search?query=` (Civic accepts `?q=`; maps to Rovas `query` because Drupal reserves `$_GET['q']` for the path) |
| `GET /users/lookup` | Community public profile — proxies Rovas `GET /rovas/users_lookup?username=` (Bearer; exact username). Returns `UserLookup` (`total_me`, `by_category`, tax months, top charity/volunteer). Percentile is computed on Civic from `/rank/distribution`. Friend invite on Komunita is client `mailto:` only (no Rovas invite API). |
| `GET /projects/:nid` | Project detail modal — proxies Rovas `GET /rovas/civic_project/{nid}` (Bearer). See Rovas **Next work: project detail + work reports**. |
| `GET /projects/:nid/work-reports` | Paginated work reports — proxies Rovas `GET /rovas/civic_project_work_reports?project_nid=` (Bearer). |

`POST /receipts/verify` sends optional Bearer; when present, Civic checks
`GET /rovas/civic_claims?receipt_uid=` and returns `already_claimed` so the
app can lock split UI + claim before submit. |

Optional Bearer:

| Route | Notes |
|-------|--------|
| `GET /rank/distribution` | Proxies Rovas `/rovas/merit_distribution`; with auth includes `user_bucket_index`, `username`, `user_merits` |

Public:

| Route | Notes |
|-------|--------|
| `GET /community/contributions/summary` | Proxies Rovas `/rovas/contributions/aggregate` |
| `GET /merit-rate` | National hourly wage for ME↔€ / claim preview — proxies Rovas `GET /rovas/civic_national_hourly_rate` (falls back to `HOURLY_WAGE_EUR` if unreachable) |

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
| € equivalent | `/merit-rate` → `hourly_wage_eur` | `GET /rovas/civic_national_hourly_rate` (fallback: Civic settings) |
| Category mix | taxes from Rovas claim summary (interim 0); charity/volunteer 0 | Aggregate `by_category` still zeros on Rovas |

**Refresh:** home re-fetches ME (+ rate/rank) on tab focus, when the app
returns to the foreground, every 5 minutes while focused, and immediately
after a successful receipt claim (`notifyMeritsChanged`).

Client: `services/api/src/rovas-client.ts`. Enable resources on rovdev via
**Enable Civic home API resources** (or `drush74 updb`) if a proxy returns 404.

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
