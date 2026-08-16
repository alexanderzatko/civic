/** Civic UI locales forwarded to Rovas as `?lang=`. */
export type CivicContentLang = "sk" | "en";

/**
 * Normalize a client `lang` query (or Accept-Language primary) to Civic/Rovas
 * content language. Unknown → `en`. Empty / missing → `undefined` (omit param).
 */
export function resolveCivicContentLang(
  raw: string | null | undefined,
): CivicContentLang | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  // Accept-Language: "en-US,en;q=0.9" → primary tag only.
  const primary = trimmed.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (!primary) return undefined;
  if (
    primary.startsWith("sk") ||
    primary.startsWith("cs") ||
    primary.startsWith("cz")
  ) {
    return "sk";
  }
  if (primary.startsWith("en")) return "en";
  return "en";
}

/** Append `lang` to a URLSearchParams when set. */
export function appendLangParam(
  params: URLSearchParams,
  lang: CivicContentLang | undefined,
): void {
  if (lang) params.set("lang", lang);
}
