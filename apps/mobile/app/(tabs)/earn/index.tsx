import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const ICON_SIZE = 26;

const PATHS = [
  {
    id: "taxes" as const,
    href: "/(tabs)/earn/receipts" as const,
    titleKey: "earn.taxes",
    descKey: "earn.taxes_desc",
    ctaKey: "earn.taxes_cta",
    howKey: "earn.how_taxes",
    color: colors.catTaxes,
    icon: { set: "mci" as const, name: "bank" as const },
  },
  {
    id: "charity" as const,
    href: "/(tabs)/earn/charity" as const,
    titleKey: "earn.charity",
    descKey: "earn.charity_desc",
    ctaKey: "earn.charity_cta",
    howKey: "earn.how_charity",
    color: colors.catCharity,
    icon: { set: "mci" as const, name: "wallet-giftcard" as const },
  },
  {
    id: "volunteer" as const,
    href: "/(tabs)/earn/volunteer" as const,
    titleKey: "earn.volunteer",
    descKey: "earn.volunteer_desc",
    ctaKey: "earn.volunteer_cta",
    howKey: "earn.how_volunteer",
    color: colors.catVolunteer,
    icon: { set: "mi" as const, name: "volunteer-activism" as const },
  },
];

type PathId = (typeof PATHS)[number]["id"];

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
function RichText({
  text,
  style,
  boldStyle,
}: {
  text: string;
  style: object;
  boldStyle: object;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={boldStyle}>
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
  const [helpId, setHelpId] = useState<PathId | null>(null);
  const helpPath = PATHS.find((p) => p.id === helpId) ?? null;

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
            <Pressable
              style={styles.helpBtn}
              onPress={() => setHelpId(path.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("earn.how_a11y").replace(
                "{{area}}",
                t(path.titleKey),
              )}
            >
              <Text style={styles.helpBtnText}>?</Text>
            </Pressable>
          </View>
          <RichText
            text={t(path.descKey)}
            style={styles.cardDesc}
            boldStyle={styles.cardDescBold}
          />
          <View style={styles.ctaRow}>
            <Link href={path.href} asChild>
              <Pressable style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>{t(path.ctaKey)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ))}

      <Modal
        visible={helpPath != null}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setHelpId(null)}>
          <Pressable
            style={styles.modalCard}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            {helpPath ? (
              <>
                <View style={styles.modalHeader}>
                  <PathIcon icon={helpPath.icon} color={helpPath.color} />
                  <Text style={[styles.modalTitle, { color: helpPath.color }]}>
                    {t(helpPath.titleKey)}
                  </Text>
                </View>
                <RichText
                  text={t("earn.how_intro")}
                  style={styles.modalBody}
                  boldStyle={styles.modalBodyBold}
                />
                <RichText
                  text={t(helpPath.howKey)}
                  style={styles.modalBody}
                  boldStyle={styles.modalBodyBold}
                />
                <Pressable
                  style={styles.modalClose}
                  onPress={() => setHelpId(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCloseText}>{t("common.close")}</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  cardTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  helpBtnText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.muted,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  modalBody: { fontSize: 15, lineHeight: 22, color: colors.ink },
  modalBodyBold: { fontWeight: "700" },
  modalClose: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brand,
  },
});
