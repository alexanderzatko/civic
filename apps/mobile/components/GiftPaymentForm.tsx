import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import ViewShot, { captureRef, type ViewShotRef } from "react-native-view-shot";
import { colors } from "@/constants/theme";
import { capture } from "@/lib/analytics";
import { t } from "@/lib/i18n";
import {
  encodeGiftPayBySquare,
  formatGiftAmountEur,
  parseGiftAmountEur,
  resolveGiftBeneficiaryIban,
} from "@/lib/pay-by-square";

type Props = {
  projectNid: string;
  /** Verified compact IBAN from project detail. */
  donateIban: string;
  beneficiaryName: string;
};

export function GiftPaymentForm({
  projectNid,
  donateIban,
  beneficiaryName,
}: Props) {
  const shotRef = useRef<ViewShotRef>(null);
  const [amountText, setAmountText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const amount = useMemo(() => parseGiftAmountEur(amountText), [amountText]);
  const iban = useMemo(
    () => resolveGiftBeneficiaryIban(donateIban),
    [donateIban],
  );

  const payload = useMemo(() => {
    if (amount == null) return null;
    try {
      return encodeGiftPayBySquare({
        iban: donateIban,
        amountEur: amount,
        beneficiaryName,
      });
    } catch {
      return null;
    }
  }, [amount, beneficiaryName, donateIban]);

  const validateAmount = useCallback((): number | null => {
    const parsed = parseGiftAmountEur(amountText);
    if (parsed == null) {
      setAmountError(t("project.gift_amount_invalid"));
      return null;
    }
    setAmountError(null);
    return parsed;
  }, [amountText]);

  const shareToBank = useCallback(async () => {
    setShareError(null);
    if (validateAmount() == null || !payload || !shotRef.current) {
      if (!payload) setShareError(t("project.gift_encode_error"));
      return;
    }
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setShareError(t("project.gift_share_unavailable"));
        return;
      }
      // Let the off-screen QR lay out before capture.
      await new Promise((r) => setTimeout(r, 50));
      const uri = await captureRef(shotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      capture("gift_payment_share", { project_nid: projectNid });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("project.gift_share_title"),
        UTI: "public.png",
      });
    } catch {
      setShareError(t("project.gift_share_error"));
    } finally {
      setSharing(false);
    }
  }, [payload, projectNid, validateAmount]);

  const openPreview = useCallback(() => {
    setShareError(null);
    if (validateAmount() == null || !payload) {
      if (parseGiftAmountEur(amountText) != null && !payload) {
        setShareError(t("project.gift_encode_error"));
      }
      return;
    }
    capture("gift_payment_preview", { project_nid: projectNid });
    setPreviewOpen(true);
  }, [amountText, payload, projectNid, validateAmount]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.disclaimer}>{t("project.gift_disclaimer")}</Text>

      <Text style={styles.label}>{t("project.gift_amount_label")}</Text>
      <View style={styles.amountRow}>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={(v) => {
            setAmountText(v);
            setAmountError(null);
            setShareError(null);
          }}
          placeholder={t("project.gift_amount_placeholder")}
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={t("project.gift_amount_label")}
        />
        <Text style={styles.currency}>{t("project.gift_currency")}</Text>
      </View>
      {amountError ? <Text style={styles.error}>{amountError}</Text> : null}

      <Text style={styles.hint}>{t("project.gift_share_hint")}</Text>

      <Pressable
        style={[styles.primaryBtn, sharing && styles.btnDisabled]}
        onPress={() => void shareToBank()}
        disabled={sharing}
        accessibilityRole="button"
      >
        {sharing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t("project.gift_share")}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondaryBtn}
        onPress={openPreview}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>{t("project.gift_preview")}</Text>
      </Pressable>

      {shareError ? <Text style={styles.error}>{shareError}</Text> : null}

      {/* Off-screen PAY by square card for share capture */}
      {payload ? (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <ViewShot
            ref={shotRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
          >
            <PayBySquareCard
              payload={payload}
              amount={amount!}
              beneficiaryName={beneficiaryName}
              iban={iban}
            />
          </ViewShot>
        </View>
      ) : null}

      <Modal
        visible={previewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{t("project.gift_preview")}</Text>
            {payload && amount != null ? (
              <PayBySquareCard
                payload={payload}
                amount={amount}
                beneficiaryName={beneficiaryName}
                iban={iban}
              />
            ) : null}
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setPreviewOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PayBySquareCard({
  payload,
  amount,
  beneficiaryName,
  iban,
}: {
  payload: string;
  amount: number;
  beneficiaryName: string;
  iban: string;
}) {
  return (
    <View style={styles.qrCard} collapsable={false}>
      <Text style={styles.payBySquareMark}>{t("project.gift_pay_by_square")}</Text>
      <View style={styles.qrWrap} collapsable={false}>
        <QRCode value={payload} size={200} backgroundColor="#FFFFFF" color="#000000" />
      </View>
      <Text style={styles.qrMeta} numberOfLines={2}>
        {beneficiaryName}
      </Text>
      <Text style={styles.qrMeta}>
        {formatGiftAmountEur(amount)} {t("project.gift_currency")}
      </Text>
      <Text style={styles.qrIban} selectable>
        {iban}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  disclaimer: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 4,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  currency: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    minWidth: 36,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.brand,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },
  offscreen: {
    position: "absolute",
    left: -4000,
    top: 0,
    opacity: 1,
  },
  qrCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    alignItems: "center",
    gap: 8,
    width: 280,
  },
  payBySquareMark: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: "#000000",
  },
  qrWrap: {
    padding: 8,
    backgroundColor: "#FFFFFF",
  },
  qrMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#12241C",
    textAlign: "center",
  },
  qrIban: {
    fontSize: 12,
    color: "#5B6B63",
    textAlign: "center",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    alignSelf: "stretch",
  },
});
