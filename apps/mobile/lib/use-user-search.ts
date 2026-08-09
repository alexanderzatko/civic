import { useEffect, useState } from "react";
import type { UserSearchResult } from "@civic/shared";
import { searchUsers } from "@/lib/api";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

type Options = {
  /** When false, clears results and skips network (e.g. signed out / modal closed). */
  enabled?: boolean;
  /** Optional uid filter (split-claim: exclude people already on the share list). */
  excludeUids?: Set<string>;
};

/**
 * Debounced Rovas user typeahead — same contract as Receipts add-recipient search
 * (`GET /users/search`, ≥3 chars).
 */
export function useUserSearch(query: string, options: Options = {}) {
  const { enabled = true, excludeUids } = options;
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(false);
    const handle = setTimeout(() => {
      void searchUsers(q)
        .then((rows) => {
          if (cancelled) return;
          const filtered = excludeUids
            ? rows.filter((r) => !excludeUids.has(r.rovas_uid))
            : rows;
          setResults(filtered);
          setSearching(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setSearching(false);
          setSearchError(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, enabled, excludeUids]);

  return {
    results,
    searching,
    searchError,
    queryLongEnough: query.trim().length >= MIN_QUERY,
  };
}
