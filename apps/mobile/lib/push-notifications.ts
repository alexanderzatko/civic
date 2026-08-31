import { Platform } from "react-native";
import Constants from "expo-constants";
import { registerPushToken, unregisterPushToken } from "@/lib/api";

type NotificationsModule = typeof import("expo-notifications");

let configured = false;

const PUSH_TOKEN_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("push token request timed out")),
      ms,
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function getNotifications(): Promise<NotificationsModule | null> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function ensureNotificationHandler(
  Notifications: NotificationsModule,
): Promise<void> {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  configured = true;
}

/** Register this device for Civic push (Phase 4 — requires dev build). */
export async function registerCivicPushToken(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await ensureNotificationHandler(Notifications);

  const perms = await Notifications.getPermissionsAsync();
  let granted = perms.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  let token: string | undefined;
  try {
    const tokenResult = await withTimeout(
      Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      ),
      PUSH_TOKEN_TIMEOUT_MS,
    );
    token = tokenResult.data?.trim();
  } catch {
    return;
  }
  if (!token) return;

  await registerPushToken({
    expo_push_token: token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
}

export async function unregisterCivicPushToken(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  // Civic API clears all tokens for the user when expo_push_token is omitted.
  // Do not call getExpoPushTokenAsync here — it can hang on emulators and
  // blocked sign-out / token refresh while the session was still clearing.
  await unregisterPushToken().catch(() => undefined);
}
