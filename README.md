# Civic

Civic allows you to see and grow your economic value **contribution to society (giving)**,  
expressed as **Merits (ME)** on your [Rovas](https://rovas.app) account. See [NeoFund](https://neofund.sk) for more info.

Three Merit-earning paths:

1. **Tax payment** — VAT verified via eKasa receipt scan (split claims supported)
2. **Gifts** — gift to a verified public-benefit / nonprofit organisation
3. **Volunteer work** — work reports against Rovas projects (NACE, proof, verification)

Merits follow the Rovas convention (**10 ME = 1 hour**). Identity lives on Rovas;
Civic signs in with native Google / Apple (and other IdPs) via the Civic API — no
separate Civic password store.

## Status

| Area | State |
|---|---|
| Receipts | Scan / verify / claim, fraud controls, split claims, history |
| Gifts | Public nonprofit catalog + invite; in-app payment deferred |
| Volunteer | Work-report form + pending verification |
| Invest | Stub list → Rovas project pages |
| Home / Community / Profile | Contribution dashboard, user lookup, Merit ledger |
| Prínos (ME•ter) | Merit Index leaderboard + filters |
| Auth | Google / Apple / Facebook / Nabezky / OSM → Civic API → Rovas OAuth |
| API | `https://civic-api.rovas.app` |
| Mobile | Dev client, TestFlight, release APK; public store release deferred |

Still deferred: in-app gifts/invest payments, GPS fraud heuristics, income-tax Merits,
Trusted User via Slovak eID, Postgres.

UI browsing can use Expo Go; **camera + native Google/Apple sign-in** need a
development build.

## Repository layout

| Path | Contents |
|---|---|
| [`apps/mobile`](apps/mobile) | Expo (Expo Router) — Slovak primary UI, EN fallback |
| [`services/api`](services/api) | Fastify API — eKasa, claims, volunteer, rank proxies |
| [`packages/shared`](packages/shared) | Types, Merit math, QR/UID parsing, settings defaults |
| [`deploy/civic-api`](deploy/civic-api) | Docker + nginx packaging for the API |
| [`docs/`](docs/) | Integration and fiscal-receipt notes |
| [`identity/`](identity/) | Logos and brand notes |

## Quick start

Requires Node **22.13+** and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env                 # API overrides (optional)
cp apps/mobile/.env.example apps/mobile/.env

pnpm --filter @civic/shared build    # if shared changed
pnpm dev:api                         # http://localhost:3001
pnpm dev:mobile                      # Expo
```

For device testing against the hosted API, set in `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=https://civic-api.rovas.app
```

`EXPO_PUBLIC_*` values are baked in at Metro start — restart Metro after changing
`apps/mobile/.env`.

Net hourly wage for Merit conversion prefers the Rovas national rate
(`GET /merit-rate`). `HOURLY_WAGE_EUR` in [`.env.example`](.env.example) is
fallback only — see [`packages/shared/src/settings.ts`](packages/shared/src/settings.ts).

## Docs

- [`docs/rovas-integration.md`](docs/rovas-integration.md) — Civic ↔ Rovas OAuth and API routes
- [`docs/ekasa-receipt-api.md`](docs/ekasa-receipt-api.md) — FS receipt/find contract
- [`docs/eu-fiscal-receipt-systems.md`](docs/eu-fiscal-receipt-systems.md) — EU fiscal-receipt notes

## Brand

- **Civic** — from Latin *civicus* (“of or pertaining to a citizen”); cousin of
*city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, shown with the Civic mark in product surfaces.
- **Rovas / Rováš** — EN: **Rovas**. SK UI: always accented **Rováš**, locative
**v Rováši**. Wire names stay ASCII (`rovas.app`, `ROVAS_`*).

## License

[GNU General Public License, version 2](LICENSE).
