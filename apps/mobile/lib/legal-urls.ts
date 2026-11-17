/**
 * Canonical legal / glossary URLs opened in the system browser.
 * Override via EXPO_PUBLIC_LEGAL_* for preview or when NeoFund pages go live.
 * Do not reuse EXPO_PUBLIC_ROVAS_BASE_URL here (that may point at dev.rovas.app).
 */

import type { Locale } from "@/lib/i18n";

const DEFAULT_PRIVACY = "https://rovas.app/privacy";
const DEFAULT_TERMS = "https://rovas.app/rules";
const DEFAULT_GLOSSARY = "https://rovas.app/rules";
/** Public product site for operator links on About (not OAuth). */
const DEFAULT_ROVAS_SITE = "https://rovas.app";
const DEFAULT_NEOFUND_SITE = "https://neofund.sk";

function trimUrl(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : fallback;
}

function neofundOrigin(): string {
  return getNeofundSiteUrl().replace(/\/$/, "");
}

export function getPrivacyUrl(): string {
  return trimUrl(process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL, DEFAULT_PRIVACY);
}

export function getTermsUrl(): string {
  return trimUrl(process.env.EXPO_PUBLIC_LEGAL_TERMS_URL, DEFAULT_TERMS);
}

export function getGlossaryUrl(): string {
  return trimUrl(process.env.EXPO_PUBLIC_LEGAL_GLOSSARY_URL, DEFAULT_GLOSSARY);
}

export function getRovasSiteUrl(): string {
  return trimUrl(process.env.EXPO_PUBLIC_ROVAS_SITE_URL, DEFAULT_ROVAS_SITE);
}

/** Drupal password-reset form on the public Rovas site (not OAuth / API base). */
export function getRovasPasswordResetUrl(): string {
  return `${getRovasSiteUrl().replace(/\/$/, "")}/user/password`;
}

export function getNeofundSiteUrl(): string {
  return trimUrl(process.env.EXPO_PUBLIC_NEOFUND_SITE_URL, DEFAULT_NEOFUND_SITE);
}

/** NeoFund Rovas API docs — path is language-specific. */
export function getRovasApiDocsUrl(locale: Locale): string {
  const lang = locale === "en" ? "en" : "sk";
  return `${neofundOrigin()}/${lang}/rovas-api/`;
}

/**
 * NeoFund list of third-party Rovas connectors / apps.
 * EN: `/en/rovas-connectors/`; SK: `/sk/rovas-konektory/`.
 */
export function getRovasConnectorsUrl(locale: Locale): string {
  if (locale === "en") {
    return `${neofundOrigin()}/en/rovas-connectors/`;
  }
  return `${neofundOrigin()}/sk/rovas-konektory/`;
}
