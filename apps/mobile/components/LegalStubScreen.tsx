import { ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Kind = "terms" | "privacy";

export function LegalStubScreen({ kind }: { kind: Kind }) {
  const title =
    kind === "terms" ? t("legal.terms_title") : t("legal.privacy_title");
  const body =
    kind === "terms" ? t("legal.terms_stub") : t("legal.privacy_stub");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
