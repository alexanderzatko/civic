import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

const ALLOW_CHRONS_KEY = "civic.prefs.allow_chrons";

type ChronPreferenceContextValue = {
  /** When true, volunteer reports may choose Chrons; Profile may show CHR. */
  allowChrons: boolean;
  ready: boolean;
  setAllowChrons: (enabled: boolean) => Promise<void>;
};

const ChronPreferenceContext =
  createContext<ChronPreferenceContextValue | null>(null);

async function loadAllowChrons(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(ALLOW_CHRONS_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

async function saveAllowChrons(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(ALLOW_CHRONS_KEY, "1");
    } else {
      await SecureStore.deleteItemAsync(ALLOW_CHRONS_KEY);
    }
  } catch {
    // Best-effort persistence.
  }
}

export function ChronPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [allowChrons, setAllowChronsState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadAllowChrons();
      if (cancelled) return;
      setAllowChronsState(stored);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAllowChrons = useCallback(async (enabled: boolean) => {
    setAllowChronsState(enabled);
    await saveAllowChrons(enabled);
  }, []);

  const value = useMemo<ChronPreferenceContextValue>(
    () => ({
      allowChrons,
      ready,
      setAllowChrons,
    }),
    [allowChrons, ready, setAllowChrons],
  );

  return (
    <ChronPreferenceContext.Provider value={value}>
      {children}
    </ChronPreferenceContext.Provider>
  );
}

export function useChronPreference(): ChronPreferenceContextValue {
  const ctx = useContext(ChronPreferenceContext);
  if (!ctx) {
    throw new Error(
      "useChronPreference must be used within ChronPreferenceProvider",
    );
  }
  return ctx;
}
