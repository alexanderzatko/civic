import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerificationNotificationBanner } from "@/components/VerificationNotificationBanner";
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

export function CivicScreenHeader({
  navigation,
  options,
  back,
}: {
  navigation: { goBack: () => void };
  options: { title?: string; headerTitle?: unknown };
  back?: unknown;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const title = headerTitleText(options);

  return (
    <View style={{ backgroundColor: colors.brand, paddingTop: insets.top }}>
      <View style={styles.bar}>
        {back ? (
          <Pressable
            onPress={navigation.goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={styles.backBtn}
          >
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.side} />
      </View>
      <VerificationNotificationBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  side: {
    width: 44,
  },
  backBtn: {
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
