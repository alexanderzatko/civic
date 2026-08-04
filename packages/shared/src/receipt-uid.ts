/**
 * Extract eKasa receipt UID from QR payload or raw string.
 *
 * Online receipts: `O-` + 32 hex chars (case-insensitive).
 * QR may be the UID alone or a URL containing it.
 *
 * Thermal prints often render the letter O as `0` in the human-readable UID
 * line — accept `0-` and normalize to `O-`.
 */

const UID_PATTERN = /[O0]-[A-F0-9]{32}/i;

export function parseReceiptUid(qrOrUid: string): string | null {
  const trimmed = qrOrUid.trim();
  if (!trimmed) return null;

  if (/^[O0]-[A-F0-9]{32}$/i.test(trimmed)) {
    return normalizeUid(trimmed);
  }

  const match = trimmed.match(UID_PATTERN);
  return match ? normalizeUid(match[0]) : null;
}

export function normalizeUid(uid: string): string {
  const upper = uid.toUpperCase();
  // Always letter-O prefix + uppercase hex
  return `O-${upper.slice(2)}`;
}

export function isValidReceiptUid(value: string): boolean {
  return /^[O0]-[A-F0-9]{32}$/i.test(value.trim());
}
