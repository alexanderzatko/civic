import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
import { giveChrons } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  visible: boolean;
  balance: number;
  onClose: () => void;
  /** Called with the new Chron balance after a successful conversion. */
  onSuccess: (totalChr: number) => void;
};

function formatChr(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function GiveChronsModal({
  visible,
  balance,
  onClose,
  onSuccess,
}: Props) {
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gained, setGained] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmountText("");
    setSubmitting(false);
    setError(null);
    setGained(null);
  }, [visible]);

  async function onSubmit() {
    const parsed = Number(amountText.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t("earn.give_chrons_error_amount"));
      return;
    }
    if (parsed > balance + 1e-9) {
      setError(t("earn.give_chrons_error_balance"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await giveChrons(parsed);
      setGained(result.merits_gained);
      onSuccess(result.total_chr);
    } catch {
      setError(t("earn.give_chrons_error_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const success = gained != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.card}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <Text style={styles.title}>{t("earn.give_chrons")}</Text>
          {success ? (
            <>
              <Text style={styles.success}>
                {t("earn.give_chrons_success").replace(
                  "{{merits}}",
                  formatChr(gained),
                )}
              </Text>
              <Pressable
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.closeText}>{t("common.close")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.balance}>
                {t("earn.give_chrons_balance").replace(
                  "{{balance}}",
                  formatChr(balance),
                )}
              </Text>
              <Text style={styles.label}>{t("earn.give_chrons_amount")}</Text>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                placeholder={t("earn.give_chrons_amount_placeholder")}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={styles.input}
                editable={!submitting}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>{t("common.close")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, submitting && styles.submitDisabled]}
                  onPress={() => void onSubmit()}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>
                      {t("earn.give_chrons_submit")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.catVolunteer,
  },
  balance: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  success: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
  submitBtn: {
    backgroundColor: colors.catVolunteer,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 100,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  closeBtn: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brand,
  },
});
