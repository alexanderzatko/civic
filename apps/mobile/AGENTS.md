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

Slovak copy uses **sentence case** for these terms: lowercase mid-sentence
(`získať merity`), capital only at sentence start or as a standalone label
(`Merity`). English keeps the capitalized *terminus technicus*.

See `.cursor/rules/civic-terminology.mdc` and the NeoFund glossary linked from
the repo README.

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
- Capture is **disabled in `__DEV__`** and when the API key is empty. To smoke-
  test Live events, use a preview/production build or temporarily remove
  `disabled: __DEV__` in `app/_layout.tsx`.
- No session replay. Privacy disclosure: `~/Documents/Business/NeoFund_NP/privacy-policy.md`.
