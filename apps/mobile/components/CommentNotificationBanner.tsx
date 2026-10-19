import { useSyncExternalStore } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { PendingCommentNoticeItem } from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import {
  getPendingCommentNotices,
  subscribePendingCommentNotices,
} from "@/lib/pending-comment-notices";
import { t } from "@/lib/i18n";

type Props = {
  visible: boolean;
  items: PendingCommentNoticeItem[];
};

/** Rovas `section#block-rovas-comment-watch-pending` — pending watched comments (no hooks). */
export function CommentNotificationBanner({ visible, items }: Props) {
  if (!visible || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>{t("comments.notifications_title")}</Text>
      <Text style={styles.body}>{t("comments.notifications_body")}</Text>
      <View style={styles.links}>
        {items.map((item) => (
          <Pressable
            key={item.cid}
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(item.comment_url);
            }}
          >
            <Text style={styles.link}>{item.node_title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Reads the shared pending-comment-notices store (safe inside nav headers). */
export function CommentNotificationBannerConnected() {
  const { status } = useAuth();
  const pending = useSyncExternalStore(
    subscribePendingCommentNotices,
    getPendingCommentNotices,
    getPendingCommentNotices,
  );
  const signedIn = status === "signedIn";

  return (
    <CommentNotificationBanner
      visible={signedIn && pending.total > 0 && pending.items.length > 0}
      items={pending.items}
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
