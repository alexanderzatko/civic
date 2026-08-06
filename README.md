# Civic

A Slovak-first mobile contribution hub that lets users see and grow their **contribution to society**, expressed in **Merits (ME)** on their [Rovas](https://rovas.app) account.

Three Merit-earning paths are surfaced from day one:

1. **Tax payment** — VAT verified via eKasa receipt scan (v1)
2. **Charitable contribution** — donate to or invest in a Rovas-listed project
3. **Volunteer work** — report hours against a Rovas project

Merits represent labor-hour equivalents (Rovas convention: **10 ME = 1 hour**).

> **NeoFund docs:** When writing product copy or defining Merits, Chrons, funds, or volunteer flows, consult the **NeoFund f.o.** project documentation at [`~/Documents/Business/NeoFund_NP`](../../Business/NeoFund_NP) — especially [`glossary.md`](../../Business/NeoFund_NP/glossary.md), [`about-us.md`](../../Business/NeoFund_NP/about-us.md) / [`about-us-sk.md`](../../Business/NeoFund_NP/about-us-sk.md), and [`neofund-site-rewrite-brief.md`](../../Business/NeoFund_NP/neofund-site-rewrite-brief.md). Those definitions take precedence over older Rovas UI strings.

## Status

Phase 2 in progress: monorepo + verify + OAuth + solo claim wired; split-claim
UI + `/users/search` proxy landed (Rovas `users_search?query=`).

Mobile targets **Expo SDK 54**. UI browsing can use Expo Go; **camera + OAuth**
need a development build (Expo Go cannot claim `civic://`).

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

# Terminal 2 — Expo (simulator / Expo Go only)
pnpm dev:mobile
```

`pnpm dev:mobile` is **not** enough for a physical iPhone — use
`pnpm dev:mobile:tunnel` (or `pnpm dev:mobile:lan` if tunnel fails) below.
Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` if the client cannot reach
`http://localhost:3001` (use your Mac’s LAN IP).

### Physical iPhone (camera + login)

Expo Go cannot handle the `civic://oauth/callback` redirect. Use the **Civic**
development build on the phone.

**Xcode / `ios:device` only installs the native shell.** It does not start the
JS bundler. After a rebuild you still need Metro running every session, or the
launcher shows “No development servers found” / “error loading app”.

**Once (or after native changes):** plug in the phone, unlock it, then:

```bash
pnpm --filter @civic/mobile ios:device
```

Xcode must have your Apple ID under **Settings → Accounts**, and the Civic
target must use **Automatically manage signing** with your Personal Team.

**Each test session** (API + Metro; do not skip Metro):

```bash
# Terminal 1 — API (LAN IP must match apps/mobile/.env)
pnpm dev:api

# Terminal 2 — Metro via tunnel (preferred when ngrok cooperates)
pnpm dev:mobile:tunnel
```

Wait until the terminal prints a tunnel URL (`https://….exp.direct`). That URL
is **new every session** — an old one in the app’s Recently Opened list (gray
dot) is dead; do not reuse it.

1. Open the **Civic** app on the phone (not Expo Go).
2. If nothing appears under Development Servers: **Enter URL manually** → paste
   the **fresh** tunnel URL from the terminal (not Recently Opened).
3. If port 8081 is already in use, cancel a second `pnpm dev:mobile` / Expo
   start — reuse the existing Metro, or kill the old process and start one
   Metro session. Prefer one bundler on 8081; don’t switch the phone to 8082
   unless you mean to.
4. Same Wi‑Fi is still useful for the API at `EXPO_PUBLIC_API_URL`; tunnel only
   carries the JS bundle.

#### If tunnel fails (`remote gone away` / ngrok error)

Expo’s built-in tunnel (`@expo/ngrok`) is flaky even when
[ngrok status](https://status.ngrok.com/) is green. Retry once.

**LAN fallback** (only if phone ↔ Mac on the same Wi‑Fi can talk — some APs
block client-to-client):

```bash
pnpm dev:mobile:lan
```

On the phone → **Enter URL manually** → `http://<Mac-LAN-IP>:8081`  
(same host as in `EXPO_PUBLIC_API_URL`).

**If LAN is blocked** (common here): run Metro on LAN locally, then expose it
with the **system** `ngrok` CLI (authenticated install), and point Expo at that
public URL:

```bash
# Terminal 2 — Metro (binds localhost:8081)
pnpm dev:mobile:lan

# Terminal 3 — authenticated ngrok (separate from Expo’s flaky tunnel)
ngrok http 8081
```

Copy the `https://….ngrok-free.dev` URL from ngrok, restart Metro once with:

```bash
EXPO_PACKAGER_PROXY_URL=https://….ngrok-free.dev pnpm dev:mobile:lan
```

On the phone → **Enter URL manually** → that same `https://….ngrok-free.dev`
URL (not Recently Opened, not the LAN IP).

Symptoms of dead Metro: gray Recently Opened `exp.direct`, “No development
servers found”, “error loading app”.

OAuth details: [`docs/rovas-integration.md`](docs/rovas-integration.md).

### Merit settings

Net hourly wage for Merit conversion prefers the Rovas admin **national hourly
rate** (`GET /merit-rate` → Rovas). `HOURLY_WAGE_EUR` in [`.env.example`](.env.example)
is fallback only — see [`packages/shared/src/settings.ts`](packages/shared/src/settings.ts).
v1 uses **net** wage basis.

## Brand

- **Civic** — from Latin *civicus* ("of or pertaining to a citizen"); cousin of *city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, displayed alongside the Civic mark in product surfaces.

## License

TBD.
