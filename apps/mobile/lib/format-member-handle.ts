import { t } from "@/lib/i18n";

const PLACEHOLDER_DISPLAY_NAME = "nomen omen";

/**
 * `@username · Full Name · since YYYY` for Home / Community profile.
 * Omits the display name when it equals the username or the Rovas
 * placeholder "nomen omen".
 */
export function formatMemberHandle(opts: {
  username: string;
  displayName?: string | null;
  memberSinceYear?: number | null;
}): string {
  const parts = [`@${opts.username}`];
  const display = opts.displayName?.trim() ?? "";
  if (
    display &&
    display.toLowerCase() !== PLACEHOLDER_DISPLAY_NAME &&
    display.toLowerCase() !== opts.username.toLowerCase()
  ) {
    parts.push(display);
  }
  if (opts.memberSinceYear != null && opts.memberSinceYear > 0) {
    parts.push(
      t("impact.member_since").replace(
        "{{year}}",
        String(opts.memberSinceYear),
      ),
    );
  }
  return parts.join(" · ");
}
