import { Stack } from "expo-router";
import { colors } from "@/constants/theme";
import { useLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";

export default function EarnLayout() {
  useLocale();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("earn.title") }} />
      <Stack.Screen name="receipts" options={{ title: t("receipts.title") }} />
      <Stack.Screen name="charity" options={{ title: t("charity.title") }} />
      <Stack.Screen
        name="volunteer"
        options={{ title: t("volunteer.title") }}
      />
      <Stack.Screen name="invest" options={{ title: t("invest.title") }} />
      <Stack.Screen
        name="verify/[slot_nid]"
        options={{ title: t("verify.screen_title") }}
      />
    </Stack>
  );
}
