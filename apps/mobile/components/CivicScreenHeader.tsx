import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommentNotificationBannerConnected } from "@/components/CommentNotificationBanner";
import { TrustedNotificationBannerConnected } from "@/components/TrustedNotificationBanner";
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
  route,
  back,
}: {
  navigation: { goBack: () => void };
  options: { title?: string; headerTitle?: unknown };
  route?: { name?: string };
  back?: unknown;
}) {
  const title = headerTitleText(options);
  const onAbout = route?.name === "about";
  const showAbout = !back && !onAbout;

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
              router.push("/(tabs)/about");
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
      <TrustedNotificationBannerConnected />
      <VerificationNotificationBannerConnected />
      <CommentNotificationBannerConnected />
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
