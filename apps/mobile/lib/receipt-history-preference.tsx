import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ReceiptHistoryRetention } from "@civic/shared";
import { useAuth } from "@/lib/auth";
import {
  fetchMe,
  setReceiptHistoryPreference,
  type ReceiptHistoryPreferenceResult,
} from "@/lib/api";

type ReceiptHistoryPreferenceContextValue = {
  /** `null` until the user has answered on Rovas. */
  retention: ReceiptHistoryRetention | null;
  /** False while loading from `/me` when signed in. */
  ready: boolean;
  /**
   * Persist on Rovas. Returns scrub count when switching to policy may
   * have nulled aged merchant/time fields.
   */
  setRetention: (
    value: ReceiptHistoryRetention,
  ) => Promise<ReceiptHistoryPreferenceResult>;
  /** Re-read from `/me` (e.g. after sign-in). */
  refresh: () => Promise<void>;
};

const ReceiptHistoryPreferenceContext =
  createContext<ReceiptHistoryPreferenceContextValue | null>(null);

export function ReceiptHistoryPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status } = useAuth();
  const [retention, setRetentionState] =
    useState<ReceiptHistoryRetention | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== "signedIn") {
      setRetentionState(null);
      setReady(true);
      return;
    }
    setReady(false);
    try {
      const me = await fetchMe();
      const value = me.receipt_history_retention;
      setRetentionState(value === "keep" || value === "policy" ? value : null);
    } catch {
      setRetentionState(null);
    } finally {
      setReady(true);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRetention = useCallback(
    async (value: ReceiptHistoryRetention) => {
      const result = await setReceiptHistoryPreference(value);
      setRetentionState(result.receipt_history_retention);
      return result;
    },
    [],
  );

  const value = useMemo<ReceiptHistoryPreferenceContextValue>(
    () => ({
      retention,
      ready,
      setRetention,
      refresh,
    }),
    [retention, ready, setRetention, refresh],
  );

  return (
    <ReceiptHistoryPreferenceContext.Provider value={value}>
      {children}
    </ReceiptHistoryPreferenceContext.Provider>
  );
}

export function useReceiptHistoryPreference(): ReceiptHistoryPreferenceContextValue {
  const ctx = useContext(ReceiptHistoryPreferenceContext);
  if (!ctx) {
    throw new Error(
      "useReceiptHistoryPreference must be used within ReceiptHistoryPreferenceProvider",
    );
  }
  return ctx;
}
