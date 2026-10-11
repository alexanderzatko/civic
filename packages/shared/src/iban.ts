/** Compact SEPA-shaped IBAN (letters/digits only, uppercase). */
const IBAN_COMPACT = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/** Strip spaces and uppercase; empty input → `""`. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Basic format check (not full MOD-97). */
export function isPlausibleIban(value: string): boolean {
  return IBAN_COMPACT.test(normalizeIban(value));
}

/**
 * Return a compact IBAN if the string looks plausible; otherwise `null`.
 * Used when passthrough-ing Rovas `donate_iban`.
 */
export function compactIbanOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = normalizeIban(value);
  if (!compact || !IBAN_COMPACT.test(compact)) return null;
  return compact;
}
