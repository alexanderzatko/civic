import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import type { PendingVerificationItem } from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import {
  getPendingVerifications,
  subscribePendingVerifications,
} from "@/lib/pending-verifications";
import { t } from "@/lib/i18n";

function verifyHref(item: PendingVerificationItem): string {
  const params = new URLSearchParams({
    work_report_nid: item.work_report_nid,
  });
  return `/(tabs)/earn/verify/${encodeURIComponent(item.slot_nid)}?${params}`;
}

/** Rovas `section#block-block-12` — pending verifications notice. */
export function VerificationNotificationBanner() {
  const { status } = useAuth();
  const pending = useSyncExternalStore(
    subscribePendingVerifications,
    getPendingVerifications,
    getPendingVerifications,
  );

  if (status !== "signedIn" || pending.total === 0 || pending.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>{t("verify.notifications_title")}</Text>
      <View style={styles.links}>
        {pending.items.map((item) => (
          <Link key={item.slot_nid} href={verifyHref(item) as never} asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>{item.title}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
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
  links: {
    gap: 4,
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.verifyBannerLink,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
