# Civic

A Slovak-first mobile contribution hub that lets users see and grow their **contribution to society**, expressed in **Merits (ME)** on their [Rovas](https://rovas.app) account.

Three Merit-earning paths are surfaced from day one:

1. **Tax payment** — VAT verified via eKasa receipt scan (v1)
2. **Charitable contribution** — donate to or invest in a Rovas-listed project
3. **Volunteer work** — report hours against a Rovas project

Merits represent labor-hour equivalents (Rovas convention: **10 ME = 1 hour**).

> **NeoFund docs:** When writing product copy or defining Merits, Chrons, funds, or volunteer flows, consult the **NeoFund f.o.** project documentation at [`~/Documents/Business/NeoFund_NP`](../../Business/NeoFund_NP) — especially [`glossary.md`](../../Business/NeoFund_NP/glossary.md), [`about-us.md`](../../Business/NeoFund_NP/about-us.md) / [`about-us-sk.md`](../../Business/NeoFund_NP/about-us-sk.md), and [`neofund-site-rewrite-brief.md`](../../Business/NeoFund_NP/neofund-site-rewrite-brief.md). Those definitions take precedence over older Rovas UI strings.

## Status

Phase 1 scaffold in progress: monorepo + `POST /receipts/verify` + Expo navigational shell with Merit preview. Claim / Rovas OAuth land in Phase 2.

Mobile targets **Expo SDK 54**. UI browsing can use Expo Go; **camera + OAuth** need a development build (Expo Go cannot claim `civic://`).

## Repository layout

| Path | Contents |
|---|---|
| [`apps/mobile`](apps/mobile) | Expo (Expo Router) client — Slovak primary UI |
| [`services/api`](services/api) | Fastify API — eKasa verify, claim (Phase 2), stubs |
| [`packages/shared`](packages/shared) | Types, Merit math, QR/UID parsing, settings defaults |
| [`docs/plan.md`](docs/plan.md) | Full product / architecture plan |
| [`docs/ekasa-receipt-api.md`](docs/ekasa-receipt-api.md) | FS receipt/find contract |
| [`docs/rovas-integration.md`](docs/rovas-integration.md) | Civic ↔ Rovas OAuth + API Bearer |
| [`identity/`](identity/) | Logos and brand notes |
| [`mocs/`](mocs/) | Screen mockups |

## Quick start

```bash
pnpm install
cp .env.example .env   # optional overrides (HOURLY_WAGE_EUR, etc.)

# Terminal 1 — API
pnpm dev:api

# Terminal 2 — Expo (simulator / Expo Go)
pnpm dev:mobile
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` if the client cannot reach `http://localhost:3001` (use your Mac’s LAN IP).

### Physical iPhone (camera + login)

Expo Go cannot handle the `civic://oauth/callback` redirect. Use the **Civic** development build already installed on the phone (rebuild only when native deps change).

**Once (or after native changes):** plug in the phone, unlock it, then:

```bash
pnpm --filter @civic/mobile ios:device
```

Xcode must have your Apple ID under **Settings → Accounts**, and the Civic target must use **Automatically manage signing** with your Personal Team.

**Each test session:**

```bash
# Terminal 1 — API (LAN IP must match apps/mobile/.env)
pnpm dev:api

# Terminal 2 — Metro via tunnel (LAN often blocked on this network)
cd apps/mobile
EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client --tunnel
```

1. Open the **Civic** app on the phone (not Expo Go).
2. If it does not auto-discover Metro: **Enter URL manually** → paste the tunnel URL from the terminal (looks like `https://….exp.direct`).
3. Same Wi‑Fi is still useful for the API at `EXPO_PUBLIC_API_URL`; tunnel only carries the JS bundle.

OAuth details: [`docs/rovas-integration.md`](docs/rovas-integration.md).

### Merit settings

Net hourly wage and fraud defaults live in [`packages/shared/src/settings.ts`](packages/shared/src/settings.ts) (`DEFAULT_SETTINGS`) and can be overridden via env — see [`.env.example`](.env.example). v1 uses **net** wage basis.

## Brand

- **Civic** — from Latin *civicus* ("of or pertaining to a citizen"); cousin of *city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, displayed alongside the Civic mark in product surfaces.

## License

TBD.
