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

Mobile targets **Expo SDK 54** so it runs in the current App Store **Expo Go** (newer SDKs are not in the store yet).

## Repository layout

| Path | Contents |
|---|---|
| [`apps/mobile`](apps/mobile) | Expo (Expo Router) client — Slovak primary UI |
| [`services/api`](services/api) | Fastify API — eKasa verify, claim (Phase 2), stubs |
| [`packages/shared`](packages/shared) | Types, Merit math, QR/UID parsing, settings defaults |
| [`docs/plan.md`](docs/plan.md) | Full product / architecture plan |
| [`docs/ekasa-receipt-api.md`](docs/ekasa-receipt-api.md) | FS receipt/find contract |
| [`identity/`](identity/) | Logos and brand notes |
| [`mocs/`](mocs/) | Screen mockups |

## Quick start

```bash
pnpm install
cp .env.example .env   # optional overrides (HOURLY_WAGE_EUR, etc.)

# Terminal 1 — API
pnpm dev:api

# Terminal 2 — Expo
pnpm dev:mobile
```

Set `EXPO_PUBLIC_API_URL` if the device cannot reach `http://localhost:3001` (use your LAN IP).

### Merit settings

Net hourly wage and fraud defaults live in [`packages/shared/src/settings.ts`](packages/shared/src/settings.ts) (`DEFAULT_SETTINGS`) and can be overridden via env — see [`.env.example`](.env.example). v1 uses **net** wage basis.

## Brand

- **Civic** — from Latin *civicus* ("of or pertaining to a citizen"); cousin of *city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, displayed alongside the Civic mark in product surfaces.

## License

TBD.
