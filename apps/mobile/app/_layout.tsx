import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PostHogProvider } from "posthog-react-native";
import { AnalyticsBridge } from "@/components/AnalyticsBridge";
import { AnalyticsIdentify } from "@/components/AnalyticsIdentify";
import { colors } from "@/constants/theme";
import {
  getPostHogApiKey,
  getPostHogHost,
  isPostHogConfigured,
} from "@/lib/analytics";
import { AuthProvider } from "@/lib/auth";
import { LocaleProvider, useLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootNavigator() {
  // Subscribe so header titles refresh when the UI locale changes.
  useLocale();

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            // Used as the iOS back-button label when pushing auth screens.
            title: t("common.back"),
            headerBackTitle: t("common.back"),
          }}
        />
        <Stack.Screen
          name="(auth)/login"
          options={{ title: t("auth.login_nav_title") }}
        />
        <Stack.Screen
          name="(auth)/register"
          options={{ title: t("auth.register_nav_title") }}
        />
        <Stack.Screen
          name="oauth/callback"
          options={{
            headerShown: false,
            animation: "none",
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const apiKey = getPostHogApiKey();
  const host = getPostHogHost();
  const disabled = __DEV__ || !isPostHogConfigured();

  return (
    <PostHogProvider
      apiKey={apiKey || "phc_disabled"}
      options={{
        host,
        enableSessionReplay: false,
        disabled,
        captureAppLifecycleEvents: !disabled,
      }}
      autocapture={false}
    >
      <AuthProvider>
        <LocaleProvider>
          <AnalyticsBridge />
          <AnalyticsIdentify />
          <RootNavigator />
        </LocaleProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
