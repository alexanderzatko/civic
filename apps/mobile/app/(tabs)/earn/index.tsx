import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

const PATHS = [
  {
    href: "/(tabs)/earn/receipts" as const,
    n: "1",
    titleKey: "earn.taxes",
    descKey: "earn.taxes_desc",
    ctaKey: "earn.taxes_cta",
  },
  {
    href: "/(tabs)/earn/charity" as const,
    n: "2",
    titleKey: "earn.charity",
    descKey: "earn.charity_desc",
    ctaKey: "earn.charity_cta",
  },
  {
    href: "/(tabs)/earn/volunteer" as const,
    n: "3",
    titleKey: "earn.volunteer",
    descKey: "earn.volunteer_desc",
    ctaKey: "earn.volunteer_cta",
  },
];

/** Renders locale strings with optional **bold** segments. */
function DescText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={styles.cardDesc}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={styles.cardDescBold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function EarnHubScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>{t("earn.subtitle")}</Text>
      {PATHS.map((path) => (
        <View key={path.href} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t(path.titleKey)}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{path.n}</Text>
            </View>
          </View>
          <DescText text={t(path.descKey)} />
          <View style={styles.ctaRow}>
            <Link href={path.href} asChild>
              <Pressable style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>{t(path.ctaKey)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  subtitle: { color: colors.muted, marginBottom: 4, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink },
  cardDesc: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  cardDescBold: { fontWeight: "700", color: colors.ink },
  ctaRow: { flexDirection: "row", justifyContent: "flex-end" },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  secondaryText: { color: colors.brandSoft, fontWeight: "600", fontSize: 14 },
});
