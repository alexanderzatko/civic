import { useCallback } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@/constants/theme";
import { getAppVersionParts } from "@/lib/app-version";
import { t } from "@/lib/i18n";
import {
  getGlossaryUrl,
  getNeofundSiteUrl,
  getPrivacyUrl,
  getRovasSiteUrl,
  getTermsUrl,
} from "@/lib/legal-urls";
import { useLocale } from "@/lib/locale";

function openExternal(url: string): void {
  void Linking.openURL(url);
}

export default function AboutScreen() {
  useLocale();
  const { version, build } = getAppVersionParts();

  const openPrivacy = useCallback(() => openExternal(getPrivacyUrl()), []);
  const openTerms = useCallback(() => openExternal(getTermsUrl()), []);
  const openGlossary = useCallback(() => openExternal(getGlossaryUrl()), []);
  const openRovas = useCallback(() => openExternal(getRovasSiteUrl()), []);
  const openNeofund = useCallback(() => openExternal(getNeofundSiteUrl()), []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand}>Civic</Text>

      <Text style={styles.sectionTitle}>{t("about.operator_title")}</Text>
      <Text style={styles.body}>
        {t("about.operator_body_before")}
        <Text
          style={styles.link}
          onPress={openRovas}
          accessibilityRole="link"
          accessibilityLabel={t("about.open_rovas_a11y")}
        >
          {t("about.operator_rovas")}
        </Text>
        {t("about.operator_body_mid")}
        <Text
          style={styles.link}
          onPress={openNeofund}
          accessibilityRole="link"
          accessibilityLabel={t("about.open_neofund_a11y")}
        >
          {t("about.operator_neofund")}
        </Text>
        {t("about.operator_body_after")}
      </Text>

      <Text style={styles.sectionTitle}>{t("about.legal_title")}</Text>
      <Pressable
        style={styles.row}
        onPress={openPrivacy}
        accessibilityRole="link"
      >
        <Text style={styles.rowLabel}>{t("legal.privacy_title")}</Text>
        <Text style={styles.rowChevron}>→</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={openTerms} accessibilityRole="link">
        <Text style={styles.rowLabel}>{t("legal.terms_title")}</Text>
        <Text style={styles.rowChevron}>→</Text>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={openGlossary}
        accessibilityRole="link"
      >
        <Text style={styles.rowLabel}>{t("about.glossary")}</Text>
        <Text style={styles.rowChevron}>→</Text>
      </Pressable>
      <Text style={styles.hint}>{t("legal.external_hint")}</Text>

      <Text style={styles.sectionTitle}>{t("about.status_section")}</Text>
      <Pressable
        style={styles.row}
        onPress={() => router.push("/status")}
        accessibilityRole="button"
        accessibilityLabel={t("about.open_status_a11y")}
      >
        <Text style={styles.rowLabel}>{t("about.open_status")}</Text>
        <Text style={styles.rowChevron}>→</Text>
      </Pressable>

      <Text style={styles.version}>
        {t("about.version")
          .replace("{{version}}", version)
          .replace("{{build}}", build)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, paddingBottom: 48 },
  brand: { fontSize: 24, fontWeight: "700", color: colors.brand, marginBottom: 4 },
  sectionTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  link: { color: colors.brand, fontWeight: "600", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, color: colors.ink, fontWeight: "600", fontSize: 15 },
  rowChevron: { color: colors.muted, fontSize: 16 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  version: {
    marginTop: 24,
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});
