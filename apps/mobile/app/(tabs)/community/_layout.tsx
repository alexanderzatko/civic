import { Stack } from "expo-router";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("community.title") }} />
      <Stack.Screen
        name="[username]"
        options={{ title: t("community.profile_title") }}
      />
    </Stack>
  );
}
