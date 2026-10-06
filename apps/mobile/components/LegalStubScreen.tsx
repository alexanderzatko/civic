import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { getPrivacyUrl, getTermsUrl } from "@/lib/legal-urls";

type Kind = "terms" | "privacy";

export function LegalStubScreen({ kind }: { kind: Kind }) {
  const title =
    kind === "terms" ? t("legal.terms_title") : t("legal.privacy_title");
  const body =
    kind === "terms" ? t("legal.terms_stub") : t("legal.privacy_stub");
  const url = kind === "terms" ? getTermsUrl() : getPrivacyUrl();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Text style={styles.hint}>{t("legal.external_hint")}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => {
          void Linking.openURL(url);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("legal.open_browser")}
      >
        <Text style={styles.btnText}>{t("legal.open_browser")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  btn: {
    marginTop: 8,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
