# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Product terminology (i18n)

**Merit / Merits** (and **Chron / Chrons**) are *termini technici* from Rovas and
Civic — **never translate** them into Slovak or English equivalents (e.g. do not
use *zásluha*, *credit*, *odmena*). Use the established forms in locale files:

| Concept | English | Slovak (examples) |
|--------|---------|-------------------|
| Merit unit | Merit, Merits, ME | Merit, merity, meritov, ME (sentence case) |
| Time token | Chron, Chrons | Chron, chrony (sentence case) |
| Platform | Rovas | **Rováš** / **v Rováši** (never *Na Rováši*; never unaccented *Rovas* in SK UI) |

Slovak copy uses **sentence case** for Merit/Chron: lowercase mid-sentence
(`získať merity`), capital only at sentence start or as a standalone label
(`Merity`). English keeps the capitalized *terminus technicus*.

**Rováš:** SK user-facing strings always use the accented form and normal
inflection (`v Rováši`). EN may use ASCII **Rovas**. Hostnames / env / API ids
remain `rovas`.

See `.cursor/rules/civic-terminology.mdc` and the NeoFund glossary linked from
the repo README.

## About + Status

- Header (tab roots only): `information-box-outline` in
  `components/CivicScreenHeader.tsx` → `/(tabs)/about` (hidden tab —
  tab bar stays visible; not a 6th menu item).
- `/(tabs)/about`: operator blurb, legal links, link to `/status`,
  app version (`lib/app-version.ts` via `expo-application`).
- `/status`: session + `GET /health` (Civic API + Rovas probe). Client:
  `fetchHealth()` in `lib/api.ts`.
- Legal URLs: `lib/legal-urls.ts` — override with `EXPO_PUBLIC_LEGAL_*` and
  optional `EXPO_PUBLIC_ROVAS_SITE_URL` / `EXPO_PUBLIC_NEOFUND_SITE_URL`
  (see `.env.example`). Do not point legal links at
  `EXPO_PUBLIC_ROVAS_BASE_URL` (may be `dev.rovas.app`).
- Auth terms/privacy screens open the same URLs in the system browser.

## Rovas integration

Any **Rovas-side** work Civic needs (API fields, Services resources, OAuth,
rules) must be written for the Rovas agent in
`~/Documents/homeProjects/rovas/docs/integration/civic.md` — not left only in
chat. Civic-side companion: `docs/rovas-integration.md`. See also the Cursor
rule `.cursor/rules/rovas-integration-docs.mdc`.

## Product analytics (PostHog Cloud EU)

- SDK: `posthog-react-native` (see `lib/analytics.ts`, root `PostHogProvider`).
- Env: `EXPO_PUBLIC_POSTHOG_API_KEY` + `EXPO_PUBLIC_POSTHOG_HOST` (default
  `https://eu.i.posthog.com`). Documented in `.env.example`; set the same on
  EAS for preview/production.
- Do **not** add the `posthog-react-native/expo` config plugin unless you are
  setting up error tracking / source-map upload (it requires `posthog-cli` and
  fails release APK builds without it). Analytics works without that plugin.
- Capture is **disabled in `__DEV__`** and when the API key is empty. To smoke-
  test Live events, use a preview/production build or temporarily remove
  `disabled: __DEV__` in `app/_layout.tsx`.
- No session replay. Privacy disclosure: `~/Documents/Business/NeoFund_NP/privacy-policy.md`.
