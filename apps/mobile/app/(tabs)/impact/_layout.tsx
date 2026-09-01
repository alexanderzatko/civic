import { Stack } from "expo-router";
import { civicStackScreenOptions } from "@/lib/civic-screen-options";
import { useLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";

export default function ImpactLayout() {
  useLocale();

  return (
    <Stack screenOptions={civicStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: t("impact.title") }} />
    </Stack>
  );
}
