import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/constants/theme";
import { AuthProvider } from "@/lib/auth";
import { t } from "@/lib/i18n";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  return (
    <AuthProvider>
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
      </Stack>
    </AuthProvider>
  );
}
