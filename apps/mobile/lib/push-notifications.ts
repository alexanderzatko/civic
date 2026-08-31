import { Platform } from "react-native";
import Constants from "expo-constants";
import { registerPushToken, unregisterPushToken } from "@/lib/api";

type NotificationsModule = typeof import("expo-notifications");

let configured = false;

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
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResult.data?.trim();
  if (!token) return;

  await registerPushToken({
    expo_push_token: token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
}

export async function unregisterCivicPushToken(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const Notifications = await getNotifications();
  if (!Notifications) {
    await unregisterPushToken().catch(() => undefined);
    return;
  }
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data?.trim();
    if (token) {
      await unregisterPushToken({ expo_push_token: token });
    } else {
      await unregisterPushToken();
    }
  } catch {
    await unregisterPushToken().catch(() => undefined);
  }
}
