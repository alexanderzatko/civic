# Civic

A Slovak-first mobile contribution hub that lets users see and grow their **contribution to society**, expressed in **Merits (ME)** on their [Rovas](https://rovas.app) account.

Three Merit-earning paths are surfaced from day one:

1. **Tax payment** — VAT verified via eKasa receipt scan (v1)
2. **Charitable contribution** — donate to or invest in a Rovas-listed project
3. **Volunteer work** — report hours against a Rovas project

Merits represent labor-hour equivalents (Rovas convention: **10 ME = 1 hour**).

> **Status:** Pre-implementation. The repository currently holds the plan, brand identity, and UI mockups. No application code yet.

## Repository layout

| Path | Contents |
|---|---|
| [`docs/plan.md`](docs/plan.md) | Full pre-implementation plan (product goals, architecture, phases, fraud controls, eKasa integration). |
| [`docs/ekasa-receipt-api.md`](docs/ekasa-receipt-api.md) | Notes on the Slovak Finančná správa eKasa receipt API. |
| [`docs/eu-fiscal-receipt-systems.md`](docs/eu-fiscal-receipt-systems.md) | Survey of EU fiscal receipt systems. |
| [`identity/`](identity/) | Logos (`civic_logo`, `ME_logo`) in `.ai` and `.svg`, plus the etymology note for the name *Civic*. |
| [`mocs/`](mocs/) | 6-screen Slovak mockup (`civic-mockup.canvas.tsx`) and Illustrator source. |

## Planned architecture

A pnpm-workspaces monorepo at this repo root:

- `apps/mobile` — Expo (React Native) client
- `services/api` — Node API backend (eKasa verification, Rovas claim proxy)
- `packages/shared` — shared types/utilities

Auth is delegated to **Rovas OAuth** (Google, Facebook, or Rovas account). The v1 build implements the VAT-receipt path end-to-end; the charity and volunteer paths ship as navigational stubs that hyperlink to existing Rovas project pages.

See [`docs/plan.md`](docs/plan.md) for the full design and phase plan.

## Brand

- **Civic** — from Latin *civicus* ("of or pertaining to a citizen"); cousin of *city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, displayed alongside the Civic mark in product surfaces.

## License

TBD.
