/**
 * OS push is disabled for now — Apple Push requires a paid Developer Program
 * team (free personal teams cannot use the Push Notifications capability).
 * In-app verification banners still work via `pending-verifications`.
 *
 * Re-enable: add `expo-notifications` plugin to app.json, restore this module
 * from git history, and run `expo prebuild --clean`.
 */

export async function registerCivicPushToken(): Promise<void> {
  // no-op
}

export async function unregisterCivicPushToken(): Promise<void> {
  // no-op
}
