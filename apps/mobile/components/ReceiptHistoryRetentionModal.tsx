import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ReceiptHistoryRetention } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { getPrivacyUrl } from "@/lib/legal-urls";

type Props = {
  visible: boolean;
  /** When true, Back only closes without saving (aborts claim). */
  onCancel: () => void;
  onChoose: (value: ReceiptHistoryRetention) => Promise<void>;
};

/**
 * First-answer consent before claiming a receipt when Rovas has no
 * `receipt_history_retention` yet. Privacy link opens in the system browser.
 */
export function ReceiptHistoryRetentionModal({
  visible,
  onCancel,
  onChoose,
}: Props) {
  const [saving, setSaving] = useState<ReceiptHistoryRetention | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(value: ReceiptHistoryRetention) {
    if (saving) return;
    setSaving(value);
    setError(null);
    try {
      await onChoose(value);
    } catch {
      setError(t("receipts.retention_save_error"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          <Text style={styles.title}>{t("receipts.retention_title")}</Text>
          <Text style={styles.body}>{t("receipts.retention_body")}</Text>

          <Pressable
            onPress={() => void Linking.openURL(getPrivacyUrl())}
            accessibilityRole="link"
            hitSlop={6}
          >
            <Text style={styles.privacyLink}>
              {t("receipts.retention_privacy_link")}
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.choiceBtn, styles.choiceKeep]}
            disabled={saving != null}
            onPress={() => void choose("keep")}
            accessibilityRole="button"
          >
            {saving === "keep" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.choiceTitleKeep}>
                  {t("receipts.retention_keep")}
                </Text>
                <Text style={styles.choiceHintKeep}>
                  {t("receipts.retention_keep_hint")}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.choiceBtn, styles.choicePolicy]}
            disabled={saving != null}
            onPress={() => void choose("policy")}
            accessibilityRole="button"
          >
            {saving === "policy" ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <>
                <Text style={styles.choiceTitlePolicy}>
                  {t("receipts.retention_policy")}
                </Text>
                <Text style={styles.choiceHintPolicy}>
                  {t("receipts.retention_policy_hint")}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.cancel}
            disabled={saving != null}
            onPress={onCancel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t("common.back")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  privacyLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
    textDecorationLine: "underline",
  },
  error: { color: "#b00020", fontSize: 13, lineHeight: 18 },
  choiceBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  choiceKeep: {
    backgroundColor: colors.brand,
  },
  choicePolicy: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  choiceTitleKeep: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  choiceHintKeep: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
  },
  choiceTitlePolicy: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 15,
  },
  choiceHintPolicy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 15,
  },
});
