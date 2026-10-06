import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VerificationNotificationBannerConnected } from "@/components/VerificationNotificationBanner";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

function headerTitleText(options: {
  title?: string;
  headerTitle?: unknown;
}): string {
  if (typeof options.headerTitle === "string") return options.headerTitle;
  if (typeof options.title === "string") return options.title;
  return "";
}

/** Custom nav header — must stay hook-free (React Navigation tab headers). */
export function CivicScreenHeader({
  navigation,
  options,
  back,
}: {
  navigation: { goBack: () => void };
  options: { title?: string; headerTitle?: unknown };
  back?: unknown;
}) {
  const title = headerTitleText(options);
  const showAbout = !back;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        {back ? (
          <Pressable
            onPress={navigation.goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={styles.sideBtn}
          >
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {showAbout ? (
          <Pressable
            onPress={() => {
              router.push("/about");
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("about.open_a11y")}
            style={styles.sideBtn}
          >
            <MaterialCommunityIcons
              name="information-box-outline"
              size={24}
              color="#fff"
            />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
      </View>
      <VerificationNotificationBannerConnected />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.brand,
  },
  bar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  side: {
    width: 44,
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "300",
    marginTop: -2,
  },
  title: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
});
