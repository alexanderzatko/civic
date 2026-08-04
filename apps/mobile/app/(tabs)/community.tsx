import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export default function CommunityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t("community.stub")}</Text>
      <TextInput
        editable={false}
        placeholder={t("community.search_placeholder")}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <View style={styles.skeleton}>
        <View style={styles.skelRow} />
        <View style={styles.skelRow} />
        <View style={styles.skelRow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  hint: { color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF2EF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.muted,
  },
  skeleton: { gap: 10, marginTop: 8 },
  skelRow: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.border,
    opacity: 0.55,
  },
});
