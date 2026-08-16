import { NativeModules, Platform } from "react-native";
import { localeFromDeviceTags, type Locale } from "@/lib/i18n";

/**
 * Preferred language tags from the OS (no native Expo module required).
 * iOS: AppleLanguages / AppleLocale; Android: I18nManager; else Intl.
 */
export function getDeviceLanguageTags(): string[] {
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
