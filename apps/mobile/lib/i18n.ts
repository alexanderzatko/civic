import sk from "../locales/sk.json";
import en from "../locales/en.json";

export type Locale = "sk" | "en";

const catalogs: Record<Locale, Record<string, string>> = { sk, en };

let current: Locale = "sk";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: string): string {
  return catalogs[current][key] ?? catalogs.en[key] ?? key;
}
