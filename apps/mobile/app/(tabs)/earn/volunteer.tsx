import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export default function VolunteerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>{t("volunteer.coming_soon")}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => void Linking.openURL("https://rovas.app")}
      >
        <Text style={styles.btnText}>{t("volunteer.open_rovas")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  body: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
