import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrácia</Text>
      <Text style={styles.body}>
        Nový Rovas účet cez HybridAuth (Google / Facebook) bude dostupný s OAuth
        serverom vo fáze 2.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  body: { color: colors.muted, lineHeight: 22 },
});
