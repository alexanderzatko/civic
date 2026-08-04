# Civic ↔ Rovas OAuth (Expo + API)

Rovas-side spike notes:
`~/Documents/homeProjects/rovas/docs/integration/civic.md`.

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
(`npx expo run:ios` / `run:android`), not Expo Go.

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
| `GET /me` | `{ rovas_uid, client_id, scope, expires_at }` — auth smoke test |
| `GET /me/contributions/summary` | Taxes-only from local `receipt_claims` for now |

Optional Bearer:

| Route | Notes |
|-------|--------|
| `GET /rank/distribution` | Placeholder buckets; with auth includes a uid hint |

`ROVAS_BASE_URL` is read from the API `.env` (default `https://dev.rovas.app`).

## Home screen data vs Rovas — what already exists

| Home need (mockup) | Civic API today | Rovas today | Gap |
|--------------------|-----------------|-------------|-----|
| Personal ME total | `/me/contributions/summary` ← local tax claims only | `POST /rovas/rules/rules_user_s_merits` (API-KEY + TOKEN of the *user*) | Need **Bearer-capable** “my Merits” read (or enable OAuth2 auth on Services + map Bearer → global `$user`) |
| Personal username | only `rovas_uid` from token | user load / profile | Prefer username (+ display name) on a small `GET /rovas/me` or UserInfo with OpenID |
| Community total ME | `/community/contributions/summary` → `0` | **none** | New `GET /rovas/contributions/aggregate` (plan §8c) |
| Category mix (taxes / charity / volunteer) | taxes from Civic claims; others 0 | not Civic-shaped | Aggregate + per-user breakdown on Rovas or derive after claim ledger exists |
| Rank ladder / histogram | placeholder `/rank/distribution` | `GET …/rovas_merit_distribution` → `{ svg, meta }` (API key today; `meta` has `bin_counts`, `user_bin`, `user_merits`, `user_name`) | Enable OAuth2 on Services **or** add a JSON-only public/Bearer resource without SVG; Civic maps `meta` → `RankDistribution` |

### Recommended Rovas follow-ups (for home parity)

1. **Enable OAuth2 authentication** on the `rovas_endpoint` Services endpoint (server `civic`) — unlocks calling existing resources with the mobile Bearer.
2. **`GET /rovas/me`** (or OpenID UserInfo) — `{ uid, username, display_name, total_me }` for the logged-in user.
3. **`GET /rovas/contributions/aggregate`** — `{ total_me, by_category? }` for the logged-out hero total.
4. **JSON merit distribution** — either expose `meta` from `rovas_merit_distribution` under Bearer without requiring API-KEY, or add `GET /rovas/merit_distribution` that returns buckets only (no SVG).

Until (2)–(4) land, Home shows real **auth identity** (`rovas_uid`) and **Civic-side tax ME** (0 until claims exist); community total stays a placeholder.
