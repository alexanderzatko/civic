/**
 * Session-scoped dismiss for the Home Merit spotlight.
 * Cleared on sign-in / sign-out so the card shows again each login.
 */
let dismissedThisSession = false;

export function isSpotlightDismissed(): boolean {
  return dismissedThisSession;
}

export function dismissSpotlight(): void {
  dismissedThisSession = true;
}

export function resetSpotlightDismiss(): void {
  dismissedThisSession = false;
}
