import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const ICON_SIZE = 22;

const PATHS = [
  {
    href: "/(tabs)/earn/receipts" as const,
    titleKey: "earn.taxes",
    descKey: "earn.taxes_desc",
    ctaKey: "earn.taxes_cta",
    color: colors.catTaxes,
    icon: { set: "mci" as const, name: "bank" as const },
  },
  {
    href: "/(tabs)/earn/charity" as const,
    titleKey: "earn.charity",
    descKey: "earn.charity_desc",
    ctaKey: "earn.charity_cta",
    color: colors.catCharity,
    icon: { set: "mci" as const, name: "wallet-giftcard" as const },
  },
  {
    href: "/(tabs)/earn/volunteer" as const,
    titleKey: "earn.volunteer",
    descKey: "earn.volunteer_desc",
    ctaKey: "earn.volunteer_cta",
    color: colors.catVolunteer,
    icon: { set: "mi" as const, name: "volunteer-activism" as const },
  },
];

function PathIcon({
  icon,
  color,
}: {
  icon: (typeof PATHS)[number]["icon"];
  color: string;
}) {
  if (icon.set === "mci") {
    return (
      <MaterialCommunityIcons
        name={icon.name}
        size={ICON_SIZE}
        color={color}
      />
    );
  }
  return <MaterialIcons name={icon.name} size={ICON_SIZE} color={color} />;
}

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
  // Subscribe so body copy refreshes when the UI locale changes.
  useLocale();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>{t("earn.subtitle")}</Text>
      {PATHS.map((path) => (
        <View
          key={path.href}
          style={[styles.card, { borderColor: path.color }]}
        >
          <View style={styles.titleRow}>
            <PathIcon icon={path.icon} color={path.color} />
            <Text style={[styles.cardTitle, { color: path.color }]}>
              {t(path.titleKey)}
            </Text>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
