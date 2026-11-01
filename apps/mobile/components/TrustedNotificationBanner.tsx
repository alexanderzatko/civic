import { useSyncExternalStore } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { getRovasSiteUrl } from "@/lib/legal-urls";
import { t } from "@/lib/i18n";
import {
  dismissTrustedNotifyBanner,
  getTrustedNotifyState,
  shouldShowTrustedNotify,
  subscribeTrustedNotify,
  type TrustedNotifyState,
} from "@/lib/trusted-notify";

type Props = {
  visible: boolean;
  rovasUid: string | null;
};

function trustedSettingsUrl(rovasUid: string): string {
  const base = getRovasSiteUrl().replace(/\/$/, "");
  return `${base}/user/${encodeURIComponent(rovasUid)}/edit#edit-trusted-user-settings`;
}

/** Rovas site-wide Trusted congratulations message (no hooks). */
export function TrustedNotificationBanner({ visible, rovasUid }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>{t("trusted.notifications_title")}</Text>
      <Text style={styles.body}>{t("trusted.notifications_body")}</Text>
      {rovasUid ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(trustedSettingsUrl(rovasUid));
          }}
        >
          <Text style={styles.link}>{t("trusted.notifications_settings")}</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void dismissTrustedNotifyBanner();
        }}
      >
        <Text style={styles.dismiss}>{t("trusted.notifications_dismiss")}</Text>
      </Pressable>
    </View>
  );
}

/** Reads the shared Trusted-notify store (safe inside nav headers). */
export function TrustedNotificationBannerConnected() {
  const { status } = useAuth();
  const state: TrustedNotifyState = useSyncExternalStore(
    subscribeTrustedNotify,
    getTrustedNotifyState,
    getTrustedNotifyState,
  );
  const signedIn = status === "signedIn";

  return (
    <TrustedNotificationBanner
      visible={signedIn && shouldShowTrustedNotify(state)}
      rovasUid={state.rovas_uid}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.verifyBanner,
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.verifyBannerInk,
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: colors.verifyBannerInk,
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.verifyBannerLink,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  dismiss: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.verifyBannerLink,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginTop: 2,
  },
});
