import { Stack } from "expo-router";
import { civicStackScreenOptions } from "@/lib/civic-screen-options";
import { useLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";

export default function CommunityLayout() {
  useLocale();

  return (
    <Stack screenOptions={civicStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: t("community.title") }} />
      <Stack.Screen
        name="[username]"
        options={{ title: t("community.profile_title") }}
      />
    </Stack>
  );
}
