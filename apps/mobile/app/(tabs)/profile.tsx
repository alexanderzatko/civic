import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Civic</Text>
      <Text style={styles.body}>{t("profile.signed_out")}</Text>
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("home.sign_in")}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  brand: { fontSize: 24, fontWeight: "700", color: colors.brand },
  body: { color: colors.muted, lineHeight: 22 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
