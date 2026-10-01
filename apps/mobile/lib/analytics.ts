import type PostHog from "posthog-react-native";
import type { PostHogEventProperties } from "@posthog/core";

/** Named product events (v1). Screen views use PostHog `$screen` via `screen()`. */
export type AnalyticsEvent =
  | "auth_signed_in"
  | "auth_signed_out"
  | "volunteer_report_submitted"
  | "receipt_claimed"
  | "verification_submitted";

let client: PostHog | null = null;

/** Wire the live PostHog client from PostHogProvider (see AnalyticsBridge). */
export function setAnalyticsClient(next: PostHog | null): void {
  client = next;
}

export function getAnalyticsClient(): PostHog | null {
  return client;
}

export function capture(
  event: AnalyticsEvent,
  properties?: PostHogEventProperties,
): void {
  client?.capture(event, properties);
}

export function screen(
  name: string,
  properties?: PostHogEventProperties,
): void {
  client?.screen(name, properties);
}

export function identify(
  rovasUid: string,
  traits?: PostHogEventProperties,
): void {
  if (!rovasUid) return;
  client?.identify(rovasUid, traits);
}

export function resetAnalytics(): void {
  client?.reset();
}

/** OAuth / sensitive query keys never sent with screen props. */
const REDACTED_PARAM_KEYS = new Set([
  "code",
  "state",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
]);

export function sanitizeScreenParams(
  params: Record<string, string | string[] | undefined>,
): PostHogEventProperties {
  const out: PostHogEventProperties = {};
  for (const [key, value] of Object.entries(params)) {
    if (REDACTED_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.join(",") : value;
  }
  return out;
}

export function getPostHogApiKey(): string {
  return (process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "").trim();
}

export function getPostHogHost(): string {
  return (
    (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "").trim() ||
    "https://eu.i.posthog.com"
  );
}

export function isPostHogConfigured(): boolean {
  return getPostHogApiKey().length > 0;
}
