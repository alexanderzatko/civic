import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth";
import { fetchMe } from "@/lib/api";
import {
  getLocale,
  localeFromDeviceTags,
  mapToCivicLocale,
  setLocale as applyLocale,
  type Locale,
} from "@/lib/i18n";

const OVERRIDE_KEY = "civic.locale.override";

type LocaleContextValue = {
  locale: Locale;
  /** Explicit profile-screen choice; null = follow device / Rovas. */
  override: Locale | null;
  ready: boolean;
  setAppLocale: (locale: Locale) => Promise<void>;
  clearOverride: () => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function deviceLocale(): Locale {
  const tags = getLocales().map(
    (l) => l.languageTag || l.languageCode || "",
  );
  return localeFromDeviceTags(tags.filter(Boolean));
}

async function loadOverride(): Promise<Locale | null> {
  try {
    const raw = await SecureStore.getItemAsync(OVERRIDE_KEY);
    if (raw === "sk" || raw === "en") return raw;
  } catch {
    // SecureStore unavailable — treat as no override.
  }
  return null;
}

async function saveOverride(locale: Locale | null): Promise<void> {
  try {
    if (locale) {
      await SecureStore.setItemAsync(OVERRIDE_KEY, locale);
    } else {
      await SecureStore.deleteItemAsync(OVERRIDE_KEY);
    }
  } catch {
    // Best-effort persistence.
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());
  const [override, setOverride] = useState<Locale | null>(null);
  const [ready, setReady] = useState(false);

  const commit = useCallback((next: Locale) => {
    applyLocale(next);
    setLocaleState(next);
  }, []);

  // Boot: restore Civic override, else device preferred language.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadOverride();
      if (cancelled) return;
      setOverride(stored);
      commit(stored ?? deviceLocale());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  // After login: prefer Rovas profile language unless the user overrode in Civic.
  useEffect(() => {
    if (!ready) return;
    if (override) {
      commit(override);
      return;
    }
    if (status !== "signedIn") {
      commit(deviceLocale());
      return;
    }

    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (me.language) {
          commit(mapToCivicLocale(me.language));
        } else {
          commit(deviceLocale());
        }
      })
      .catch(() => {
        if (!cancelled) commit(deviceLocale());
      });
    return () => {
      cancelled = true;
    };
  }, [ready, status, override, commit]);

  const setAppLocale = useCallback(
    async (next: Locale) => {
      setOverride(next);
      commit(next);
      await saveOverride(next);
    },
    [commit],
  );

  const clearOverride = useCallback(async () => {
    setOverride(null);
    await saveOverride(null);
    // Effect above re-resolves from Rovas / device once override is cleared.
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      override,
      ready,
      setAppLocale,
      clearOverride,
    }),
    [locale, override, ready, setAppLocale, clearOverride],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
