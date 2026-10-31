import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MeSourcesShare } from "@civic/shared";
import { useAuth } from "@/lib/auth";
import {
  fetchMe,
  setMeSourcesPreference,
  type MeSourcesPreferenceResult,
} from "@/lib/api";

type MeSourcesPreferenceContextValue = {
  /** Defaults to everyone when Rovas has not answered / field missing. */
  share: MeSourcesShare;
  ready: boolean;
  setShare: (value: MeSourcesShare) => Promise<MeSourcesPreferenceResult>;
  refresh: () => Promise<void>;
};

const MeSourcesPreferenceContext =
  createContext<MeSourcesPreferenceContextValue | null>(null);

function parseShare(value: unknown): MeSourcesShare {
  return value === "reciprocal" || value === "aggregate" || value === "everyone"
    ? value
    : "everyone";
}

export function MeSourcesPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status } = useAuth();
  const [share, setShareState] = useState<MeSourcesShare>("everyone");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== "signedIn") {
      setShareState("everyone");
      setReady(true);
      return;
    }
    setReady(false);
    try {
      const me = await fetchMe();
      setShareState(parseShare(me.me_sources_share));
    } catch {
      setShareState("everyone");
    } finally {
      setReady(true);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setShare = useCallback(async (value: MeSourcesShare) => {
    const result = await setMeSourcesPreference(value);
    setShareState(parseShare(result.me_sources_share));
    return result;
  }, []);

  const value = useMemo<MeSourcesPreferenceContextValue>(
    () => ({
      share,
      ready,
      setShare,
      refresh,
    }),
    [share, ready, setShare, refresh],
  );

  return (
    <MeSourcesPreferenceContext.Provider value={value}>
      {children}
    </MeSourcesPreferenceContext.Provider>
  );
}

export function useMeSourcesPreference(): MeSourcesPreferenceContextValue {
  const ctx = useContext(MeSourcesPreferenceContext);
  if (!ctx) {
    throw new Error(
      "useMeSourcesPreference must be used within MeSourcesPreferenceProvider",
    );
  }
  return ctx;
}
