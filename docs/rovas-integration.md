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
| `GET /me` | Proxies Rovas `/rovas/me` → `{ rovas_uid, username, display_name, total_me, client_id, scope, expires_at }` |
| `GET /me/contributions/summary` | `total_me` from Rovas wallet; `by_category.taxes` + receipt stats from local `receipt_claims` |
| `POST /receipts/claim` | Re-verify FS + dedup + GPS checks; grants Merits via Rovas `rules_proxy_claim_vat_receipt` |

Optional Bearer:

| Route | Notes |
|-------|--------|
| `GET /rank/distribution` | Proxies Rovas `/rovas/merit_distribution`; with auth includes `user_bucket_index`, `username`, `user_merits` |

Public:

| Route | Notes |
|-------|--------|
| `GET /community/contributions/summary` | Proxies Rovas `/rovas/contributions/aggregate` |

`ROVAS_BASE_URL` is read from the API `.env` (default `https://dev.rovas.app`).

## Home screen data (wired)

| Home need (mockup) | Civic API | Rovas source |
|--------------------|-----------|--------------|
| Personal ME total | `/me/contributions/summary` → `total_me` | `GET /rovas/me` |
| Personal username | `/me` / summary `username` | `GET /rovas/me` |
| Community total ME | `/community/contributions/summary` | `GET /rovas/contributions/aggregate` |
| Rank histogram | `/rank/distribution` | `GET /rovas/merit_distribution` |
| Category mix | taxes from Civic claims; charity/volunteer 0 | Aggregate `by_category` still zeros on Rovas |

Client: `services/api/src/rovas-client.ts`. Enable resources on rovdev via
**Enable Civic home API resources** (or `drush74 updb`) if a proxy returns 404.

## Receipt claim (solo)

Civic `POST /receipts/claim` (Bearer required) re-verifies the eKasa receipt,
dedups in SQLite, then calls Rovas:

`POST {ROVAS}/rovas/rules/rules_proxy_claim_vat_receipt`

**Rovas agents:** implement that rule per the checklist in
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../../rovas/docs/integration/civic.md)
→ **Next work: solo VAT claim**. Until it is live on `dev.rovas.app`, mobile
claim returns a Rovas/API error after a successful Merit preview.
