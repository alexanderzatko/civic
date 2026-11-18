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
import { ChronPreferenceProvider } from "@/lib/chron-preference";
import { MeSourcesPreferenceProvider } from "@/lib/me-sources-preference";
import { ReceiptHistoryPreferenceProvider } from "@/lib/receipt-history-preference";
import { civicStackScreenOptions } from "@/lib/civic-screen-options";
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
          name="(auth)/terms"
          options={{ title: t("legal.terms_title") }}
        />
        <Stack.Screen
          name="(auth)/privacy"
          options={{ title: t("legal.privacy_title") }}
        />
        <Stack.Screen
          name="status"
          options={{
            ...civicStackScreenOptions,
            title: t("status.title"),
          }}
        />
        <Stack.Screen
          name="oauth/callback"
          options={{
            headerShown: false,
            animation: "none",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="oauth/idp-return"
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
          <ChronPreferenceProvider>
            <ReceiptHistoryPreferenceProvider>
              <MeSourcesPreferenceProvider>
                <AnalyticsBridge />
                <AnalyticsIdentify />
                <RootNavigator />
              </MeSourcesPreferenceProvider>
            </ReceiptHistoryPreferenceProvider>
          </ChronPreferenceProvider>
        </LocaleProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
