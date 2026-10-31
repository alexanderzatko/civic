import { getLocales } from "expo-localization";
import { NativeModules, Platform } from "react-native";
import { localeFromDeviceTags, type Locale } from "@/lib/i18n";

/**
 * Preferred language tags from the OS, in user preference order.
 *
 * Prefer `expo-localization` (works in release / New Architecture). Legacy
 * SettingsManager / I18nManager remain as fallbacks.
 *
 * On iOS, preferred languages are filtered by the app's declared
 * localizations — see `expo-localization` `supportedLocales` in app.json.
 */
export function getDeviceLanguageTags(): string[] {
  try {
    const locales = getLocales();
    const tags = locales.flatMap((loc) => {
      const out: string[] = [];
      if (loc.languageTag) out.push(loc.languageTag);
      if (loc.languageCode) out.push(loc.languageCode);
      return out;
    });
    if (tags.length > 0) return tags;
  } catch {
    // Native module unavailable — fall through.
  }

  if (Platform.OS === "ios") {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLanguages?: unknown; AppleLocale?: unknown }
      | undefined;
    const appleLangs = settings?.AppleLanguages;
    if (Array.isArray(appleLangs) && appleLangs.length > 0) {
      return appleLangs.map(String).filter(Boolean);
    }
    if (typeof settings?.AppleLocale === "string" && settings.AppleLocale) {
      return [settings.AppleLocale];
    }
  }

  if (Platform.OS === "android") {
    const id = NativeModules.I18nManager?.localeIdentifier;
    if (typeof id === "string" && id) return [id];
  }

  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    if (tag) return [tag];
  } catch {
    // Intl unavailable — fall through.
  }

  return ["en"];
}

export function deviceLocale(): Locale {
  return localeFromDeviceTags(getDeviceLanguageTags());
}
