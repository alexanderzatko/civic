# Civic

A Slovak-first mobile contribution hub that lets users see and grow their
**contribution to society**, expressed in **Merits (ME)** on their
[Rovas](https://rovas.app) account.

Three Merit-earning paths:

1. **Tax payment** — VAT verified via eKasa receipt scan (split claims supported)
2. **Gifts** — gift to a verified public-benefit / nonprofit organisation (discovery
   + Rovas donate instructions; in-app payment deferred)
3. **Volunteer work** — file work reports against Rovas projects (NACE, proof
   photos/map/URL, in-app verification)

Merits represent labor-hour equivalents (Rovas convention: **10 ME = 1 hour**).
Identity is **Rovas OAuth** (Google, Facebook, or Rovas account) — no separate
Civic account.

> **NeoFund docs:** When writing product copy or defining Merits, Chrons, funds,
> or volunteer flows, consult the **NeoFund f.o.** project documentation at
> [`~/Documents/Business/NeoFund_NP`](../../Business/NeoFund_NP) — especially
> [`glossary.md`](../../Business/NeoFund_NP/glossary.md),
> [`about-us.md`](../../Business/NeoFund_NP/about-us.md) /
> [`about-us-sk.md`](../../Business/NeoFund_NP/about-us-sk.md), and
> [`neofund-site-rewrite-brief.md`](../../Business/NeoFund_NP/neofund-site-rewrite-brief.md).
> Those definitions take precedence over older Rovas UI strings.

## Status

**Shipped** (Expo SDK 54 + Civic API on VPS):

| Area | State |
|---|---|
| Receipts | Scan / verify / claim, fraud controls, split claims, history |
| Gifts | Public nonprofit catalog + invite; no in-app payments |
| Volunteer | Full work-report form + pending verification flow |
| Invest | Stub list → opens Rovas project pages |
| Home / Community / Profile | Contribution dashboard, user lookup, Merit ledger |
| Prínos (ME•ter) | Merit Index leaderboard + filters |
| Auth | Rovas OAuth (Authorization Code + PKCE) |
| API deploy | `https://civic-api.rovas.app` |
| Mobile builds | Dev client (iOS) + release APK (Android); EAS profiles ready |

Still deferred: in-app gifts/invest flows, GPS location fraud heuristics, income-tax
Merits / ÚPVS, App Store / Play production release, Postgres.

UI browsing can use Expo Go; **camera + OAuth** need a development build (Expo Go
cannot claim `civic://`).

## Repository layout

| Path | Contents |
|---|---|
| [`apps/mobile`](apps/mobile) | Expo (Expo Router) — Slovak primary UI, EN fallback |
| [`services/api`](services/api) | Fastify API — eKasa, claims, volunteer, rank proxies |
| [`packages/shared`](packages/shared) | Types, Merit math, QR/UID parsing, settings defaults |
| [`deploy/civic-api`](deploy/civic-api) | Docker + nginx deploy of the API to `sano-vps` |
| [`docs/ekasa-receipt-api.md`](docs/ekasa-receipt-api.md) | FS receipt/find contract |
| [`docs/rovas-integration.md`](docs/rovas-integration.md) | Civic ↔ Rovas OAuth + API routes |
| [`docs/eu-fiscal-receipt-systems.md`](docs/eu-fiscal-receipt-systems.md) | EU fiscal-receipt systems notes |
| [`identity/`](identity/) | Logos and brand notes |

Rovas-side contract / Next work:
[`~/Documents/homeProjects/rovas/docs/integration/civic.md`](../rovas/docs/integration/civic.md).

## Mobile tabs

| Tab | Route | Role |
|---|---|---|
| Domov | `/(tabs)` | Contribution summary, rank histogram, Merit spotlight |
| Prínos | `/(tabs)/impact` | Merit Index (ME•ter) leaderboard |
| Získať | `/(tabs)/earn` | Hub → receipts, gifts, volunteer, invest |
| Komunita | `/(tabs)/community` | Public profile lookup by Rovas username |
| Profil | `/(tabs)/profile` | Account, language, Merit history, sign out |

## Deploy the Civic API (VPS)

Production-like backend for phones and remote testing. SSH host alias: `sano-vps`.

```bash
./deploy/civic-api/deploy.sh
```

What it does:

1. Rsyncs `services/api`, `packages/shared`, and deploy packaging to
   `/opt/docker/civic-api`
2. Seeds `/opt/docker/civic-api/.env` from `.env.example` on first run only
   (later deploys keep the remote `.env`)
3. Ensures Let’s Encrypt + nginx-proxy for **civic-api.rovas.app**
4. `docker compose build && up -d` (host port **3001**, SQLite in `./data`)

Smoke-check:

```bash
curl https://civic-api.rovas.app/health
```

Expected: `ok: true` and `rovas_base_url` pointing at Rovas (usually
`https://dev.rovas.app`).

Point the mobile client at the VPS (default in `apps/mobile/.env`):

```bash
EXPO_PUBLIC_API_URL=https://civic-api.rovas.app
```

`EXPO_PUBLIC_*` are baked in at Metro start — restart Metro after changing
`apps/mobile/.env`.

**Note:** An Expo **dev client** still needs Metro for the JS bundle. The VPS
hosts only the API. Mac-free *user* testing (no Metro) needs an EAS
preview/release build with JS baked into the binary (Android release APK already
does this).

### Production fraud flags

Dev defaults leave the claim window and same-store daily cap **off** so old
receipts remain testable. On the VPS `/opt/docker/civic-api/.env`, set:

```bash
CLAIM_WINDOW_ENABLED=true
CLAIM_WINDOW_DAYS=1
SAME_STORE_DAILY_LIMIT_ENABLED=true
SAME_STORE_DAILY_LIMIT=2
```

Then recreate/restart the API container (`./deploy/civic-api/deploy.sh` or
`docker compose up -d`). Always-on rules (3-strike, registration-vs-purchase,
min VAT, rate limits) do not need these toggles. Rovas must expose
`created` on `GET /rovas/me` for the registration check — see
`~/Documents/homeProjects/rovas/docs/integration/civic.md`.

### Optional: local API (API development)

Use when iterating on [`services/api`](services/api) itself:

```bash
pnpm install
cp .env.example .env   # optional overrides
pnpm --filter @civic/shared build   # if shared changed
pnpm dev:api                        # http://localhost:3001
```

For a physical phone against the Mac API, set
`EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:3001` in `apps/mobile/.env`. Prefer the
VPS URL for normal device testing so the Mac can be off for the backend.

## Quick start (simulator / Expo Go)

```bash
pnpm install
cp .env.example .env   # optional; API overrides when running locally

# Expo only — API is already on the VPS when EXPO_PUBLIC_API_URL points there
pnpm dev:mobile
```

To exercise a **local** API in a second terminal: `pnpm dev:api`.

`pnpm dev:mobile` is **not** enough for a physical iPhone — use the development
build + Metro tunnel/LAN section below.

## Regenerate native projects (prebuild)

`apps/mobile/ios/` and `apps/mobile/android/` are **generated** from
`app.json` and asset files. They are gitignored. Rebuild them after changing:

- App icons or splash images (`assets/images/`)
- Native modules (adding/upgrading an Expo module)
- Native config in `app.json` (permissions, plugins, bundle id, etc.)

**Both platforms** (from repo root):

```bash
pnpm --filter @civic/mobile prebuild:clean
```

That runs `expo prebuild --clean` for Android and iOS, then `pod install` for
iOS. Or step by step from `apps/mobile`:

```bash
npx expo prebuild --clean --platform android --no-install
npx expo prebuild --clean --platform ios --no-install
bash scripts/ios-pod-install.sh
```

Prebuild alone does **not** reinstall the app on a device. Rebuild after:

| Platform | Command |
|---|---|
| iOS device | `pnpm --filter @civic/mobile ios:device` |
| Android APK | `pnpm --filter @civic/mobile android:apk` |

Platform-specific shortcuts that include prebuild + build:

- iOS: `pnpm --filter @civic/mobile ios:device:clean`
- Android: `pnpm --filter @civic/mobile android:apk:clean`

## Physical iPhone (camera + login)

Expo Go cannot handle the `civic://oauth/callback` redirect. Use the **Civic**
development build on the phone.

**Xcode / `ios:device` only installs the native shell.** It does not start the
JS bundler. After a rebuild you still need Metro every session, or the
launcher shows “No development servers found” / “error loading app”.

**Once (or after native changes):** plug in the phone, unlock it, then:

```bash
pnpm --filter @civic/mobile ios:device
```

After adding or upgrading a **native module** (e.g. `expo-image-picker`), the
existing `ios/` folder must be regenerated or the new native code is not linked.
Use a clean prebuild once:

```bash
pnpm --filter @civic/mobile ios:device:clean
```

If that command builds but fails at **launch** (common after trusting the
developer profile), finish from Xcode:

1. Open **`apps/mobile/ios/Civic.xcworkspace`** (not `.xcodeproj`).
2. **Product → Clean Build Folder**, then **Run** on your iPhone.
3. If photos still fail, delete the app from the phone and run again.

Open the **Civic** app on the phone (not Expo Go). `ios:device` alone reuses
stale native projects and modules like photo picking will still fail.

Xcode must have your Apple ID under **Settings → Accounts**, and the Civic
target must use **Automatically manage signing** with your Personal Team.

**Each test session** (VPS API is always on; start Metro for the JS bundle):

One-time: claim your free static domain at [ngrok Domains](https://dashboard.ngrok.com/domains)
and set it in `apps/mobile/.env` (see [`apps/mobile/.env.example`](apps/mobile/.env.example)):

```bash
NGROK_STATIC_DOMAIN=your-name.ngrok-free.dev
EXPO_PACKAGER_PROXY_URL=https://your-name.ngrok-free.dev
```

Requires the **system** [ngrok CLI](https://ngrok.com/download) authenticated to your
account (`ngrok config add-authtoken …`).

```bash
# Confirm API (optional)
curl -fsS https://civic-api.rovas.app/health

# Terminal 1 — Metro (uses NGROK_STATIC_DOMAIN from apps/mobile/.env)
pnpm dev:mobile:ngrok

# Terminal 2 — expose localhost:8081 on your reserved domain
pnpm ngrok:tunnel
```

Ensure `apps/mobile/.env` has `EXPO_PUBLIC_API_URL=https://civic-api.rovas.app`
before starting Metro.

On the phone → **Enter URL manually** → `https://<NGROK_STATIC_DOMAIN>` (same
every session).

1. Open the **Civic** app on the phone (not Expo Go).
2. If nothing appears under Development Servers: **Enter URL manually** → your
   static ngrok URL (not a gray Recently Opened `exp.direct` entry).
3. Start Metro before ngrok (`pnpm dev:mobile:ngrok`, then `pnpm ngrok:tunnel`).
4. If port 8081 is already in use, cancel a second `pnpm dev:mobile` / Expo
   start — reuse the existing Metro, or kill the old process and start one
   Metro session. Prefer one bundler on 8081; don’t switch the phone to 8082
   unless you mean to.
5. The API is reached over HTTPS at `EXPO_PUBLIC_API_URL`; ngrok only carries
   the JS bundle (Metro). Same Wi‑Fi as the Mac is not required for the VPS API.

**Alternative — Expo built-in tunnel** (random `*.exp.direct` URL every session):

```bash
pnpm dev:mobile:tunnel
```

Wait until the terminal prints a tunnel URL (`https://….exp.direct`). That URL
is **new every session** — an old one in the app’s Recently Opened list (gray
dot) is dead; do not reuse it.

### If tunnel fails (`remote gone away` / ngrok error)

Expo’s built-in tunnel (`@expo/ngrok`) is flaky even when
[ngrok status](https://status.ngrok.com/) is green. Prefer **`pnpm dev:mobile:ngrok`**
above; otherwise retry `pnpm dev:mobile:tunnel` once.

**LAN fallback** (only if phone ↔ Mac on the same Wi‑Fi can talk — some APs
block client-to-client):

```bash
pnpm dev:mobile:lan
```

On the phone → **Enter URL manually** → `http://<Mac-LAN-IP>:8081`.

**If LAN is blocked** (common here) but you have not set up a static ngrok
domain: run Metro on LAN locally, then expose it with the system ngrok CLI:

```bash
# Terminal 1 — Metro (binds localhost:8081)
pnpm dev:mobile:lan

# Terminal 2 — authenticated ngrok (separate from Expo’s flaky tunnel)
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

## Physical Android (APK install)

Release APK with the JS bundle embedded (no Metro required on the phone). The
Civic API is reached at `EXPO_PUBLIC_API_URL` from `apps/mobile/.env` (default
`https://civic-api.rovas.app`).

### System requirements (device)

| Requirement | Detail |
|---|---|
| **OS** | Android **7.0+** (API 24+) |
| **CPU** | `arm64-v8a`, `armeabi-v7a`, `x86`, or `x86_64` (universal APK) |
| **Storage** | ~**100 MB** free for install |
| **Network** | Internet (HTTPS to Civic API + Rovas OAuth) |
| **Camera** | Required for eKasa QR receipt scan |
| **Location** | Optional / forward-compat on claim (GPS fraud not enforced in v1) |
| **Photos** | Optional — volunteer work proof images |

### Build the APK (Mac)

One-time: [Android SDK](https://developer.android.com/studio) (or Android Studio)
with `ANDROID_HOME` pointing at the SDK, plus **JDK 17+** (JDK 21 works).

```bash
pnpm install
# Ensure apps/mobile/.env has production API URLs before building
pnpm --filter @civic/mobile android:apk
```

Output: `apps/mobile/dist/civic-0.1.0-android-release.apk` (~100 MB).

Subsequent builds are much faster (~2–5 min) once Gradle caches exist.

**After changing app icon or splash assets**, update PNGs in
`apps/mobile/assets/images/`, then run prebuild and rebuild — see
[Regenerate native projects (prebuild)](#regenerate-native-projects-prebuild).
Metro reload is not enough. If the launcher still shows a cached icon, cold-boot
the emulator once.

**Cloud alternative:** `eas.json` is configured — from `apps/mobile`, run
`npx eas build -p android --profile preview` (Expo account required).

### Install on a phone

1. Copy the APK to the device (USB, AirDrop alternative, cloud drive, etc.).
2. On the phone: **Settings → Security** → allow install from unknown sources
   (wording varies by OEM).
3. Open the APK file and confirm install.
4. Grant **Camera** (and photos if using volunteer proof) when prompted.

Package id: `app.civic.mobile`. This build includes the Expo dev-client shell
but ships a **release** JS bundle, so the app runs without a Mac/Metro session.

## Merit settings

Net hourly wage for Merit conversion prefers the Rovas admin **national hourly
rate** (`GET /merit-rate` → Rovas). `HOURLY_WAGE_EUR` in [`.env.example`](.env.example)
is fallback only — see [`packages/shared/src/settings.ts`](packages/shared/src/settings.ts).
v1 uses **net** wage basis.

## Brand

- **Civic** — from Latin *civicus* ("of or pertaining to a citizen"); cousin of *city*, *civil*, *civilization*. See [`identity/civic-linguistics.txt`](identity/civic-linguistics.txt).
- **ME** — the Merit unit, displayed alongside the Civic mark in product surfaces.

## License

TBD.
