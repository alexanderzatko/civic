import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

const PATHS = [
  {
    href: "/(tabs)/earn/receipts" as const,
    n: "1",
    titleKey: "earn.receipts",
    descKey: "earn.receipts_desc",
  },
  {
    href: "/(tabs)/earn/charity" as const,
    n: "2",
    titleKey: "earn.charity",
    descKey: "earn.charity_desc",
  },
  {
    href: "/(tabs)/earn/volunteer" as const,
    n: "3",
    titleKey: "earn.volunteer",
    descKey: "earn.volunteer_desc",
  },
  {
    href: "/(tabs)/earn/invest" as const,
    n: "4",
    titleKey: "earn.invest",
    descKey: "earn.invest_desc",
  },
];

export default function EarnHubScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>{t("earn.subtitle")}</Text>
      {PATHS.map((path) => (
        <Link key={path.href} href={path.href} asChild>
          <Pressable style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{path.n}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t(path.titleKey)}</Text>
              <Text style={styles.cardDesc}>{t(path.descKey)}</Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  subtitle: { color: colors.muted, marginBottom: 8, fontSize: 15 },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "700" },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  cardDesc: { fontSize: 14, color: colors.muted },
});
