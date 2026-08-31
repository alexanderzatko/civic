import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import type { PendingVerificationItem } from "@civic/shared";
import { colors } from "@/constants/theme";
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

type Props = {
  compact?: boolean;
};

export function VerificationNotificationCards({ compact = false }: Props) {
  const pending = useSyncExternalStore(
    subscribePendingVerifications,
    getPendingVerifications,
    getPendingVerifications,
  );

  if (pending.total === 0 || pending.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {!compact ? (
        <Text style={styles.sectionTitle}>{t("verify.notifications_title")}</Text>
      ) : null}
      {pending.items.map((item) => {
        const author = item.author_username
          ? `@${item.author_username}`
          : item.author_display_name ?? t("verify.unknown_author");
        return (
          <View key={item.slot_nid} style={styles.card}>
            <Text style={styles.cardText}>
              {t("verify.notification_body")
                .replace("{title}", item.title)
                .replace("{author}", author)}
            </Text>
            <Link href={verifyHref(item) as never} asChild>
              <Pressable style={styles.linkBtn} accessibilityRole="link">
                <Text style={styles.linkText}>{t("verify.notification_cta")}</Text>
              </Pressable>
            </Link>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  linkBtn: { alignSelf: "flex-start" },
  linkText: {
    color: colors.brand,
    fontWeight: "600",
    fontSize: 15,
  },
});
