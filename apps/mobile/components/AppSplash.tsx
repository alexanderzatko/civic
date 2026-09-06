import { Image, StyleSheet, View } from "react-native";
import { colors } from "@/constants/theme";

/**
 * In-app stand-in for the native Expo splash (brand bg + splash icon).
 * Used while OAuth deep-link return settles before Home is ready.
 */
export function AppSplash() {
  return (
    <View style={styles.root} accessibilityLabel="Civic">
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  logo: {
    width: 200,
    height: 200,
  },
});
