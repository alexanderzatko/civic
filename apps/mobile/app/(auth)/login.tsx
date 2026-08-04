import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prihlásenie</Text>
      <Text style={styles.body}>
        Rovas OAuth (Google / Facebook / Rovas účet) príde vo fáze 2. Zatiaľ
        môžete overovať bločky bez prihlásenia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  body: { color: colors.muted, lineHeight: 22 },
});
