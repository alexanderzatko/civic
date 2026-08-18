import { useEffect, useState } from "react";
import type { VolunteerProjectRow } from "@civic/shared";
import { searchProjects } from "@/lib/api";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

type Options = {
  enabled?: boolean;
};

export function useProjectSearch(query: string, options: Options = {}) {
  const { enabled = true } = options;
  const [results, setResults] = useState<VolunteerProjectRow[]>([]);
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
      void searchProjects(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r.projects);
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
  }, [query, enabled]);

  return {
    results,
    searching,
    searchError,
    queryLongEnough: query.trim().length >= MIN_QUERY,
  };
}
