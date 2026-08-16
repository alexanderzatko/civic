import sk from "../locales/sk.json";
import en from "../locales/en.json";

export type Locale = "sk" | "en";

const catalogs: Record<Locale, Record<string, string>> = { sk, en };

/** Civic-supported UI locales (no Czech pack yet). */
export const CIVIC_LOCALES: readonly Locale[] = ["sk", "en"];

let current: Locale = "en";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: string): string {
  return catalogs[current][key] ?? catalogs.en[key] ?? key;
}

/**
 * Map a BCP-47 / Drupal / partner language tag to a Civic UI locale.
 *
 * - sk → sk
 * - cs / cz → sk (until a Czech catalog exists)
 * - anything else → en
 */
export function mapToCivicLocale(raw: string | null | undefined): Locale {
  if (!raw) return "en";
  const lower = raw.trim().toLowerCase();
  if (!lower) return "en";
  if (
    lower.startsWith("sk") ||
    lower.startsWith("cs") ||
    lower.startsWith("cz")
  ) {
    return "sk";
  }
  return "en";
}

/**
 * Walk the device preferred-language list and pick the first Civic-supported
 * language (sk/cs/cz → sk, en → en). Unsupported primaries are skipped so a
 * later preferred language can still win; if none match, fall back to en.
 */
export function localeFromDeviceTags(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const lower = tag.trim().toLowerCase();
    if (!lower) continue;
    if (
      lower.startsWith("sk") ||
      lower.startsWith("cs") ||
      lower.startsWith("cz")
    ) {
      return "sk";
    }
    if (lower.startsWith("en")) {
      return "en";
    }
  }
  return "en";
}
