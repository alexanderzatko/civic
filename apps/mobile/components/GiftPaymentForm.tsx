import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import { colors } from "@/constants/theme";
import { capture } from "@/lib/analytics";
import { t } from "@/lib/i18n";
import {
  asciiBeneficiaryName,
  encodeGiftPayBySquare,
  formatGiftAmountEur,
  formatGiftPaymentDetails,
  parseGiftAmountEur,
  resolveGiftBeneficiaryIban,
} from "@/lib/pay-by-square";

/** QR module size (px) + quiet zone — banks need a real margin around the code. */
const QR_SIZE = 280;
const QR_QUIET_ZONE = 16;

type Props = {
  projectNid: string;
  /** Verified compact IBAN from project detail. */
  donateIban: string;
  beneficiaryName: string;
};

type SvgHandle = { toDataURL?: (cb: (data: string) => void) => void };

export function GiftPaymentForm({
  projectNid,
  donateIban,
  beneficiaryName,
}: Props) {
  const shotRef = useRef<ViewShot>(null);
  const svgRef = useRef<SvgHandle | null>(null);
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
  const displayName = useMemo(
    () => beneficiaryName.trim() || "Organisation",
    [beneficiaryName],
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

  const writePngFromBase64 = useCallback(async (base64: string) => {
    const clean = base64.replace(/^data:image\/png;base64,/, "");
    const path = `${FileSystem.cacheDirectory}civic-pay-by-square.png`;
    await FileSystem.writeAsStringAsync(path, clean, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  }, []);

  const captureQrPng = useCallback(async (): Promise<string> => {
    // Prefer SVG→PNG (sharp modules). Fall back to ViewShot of the on-screen QR.
    const fromSvg = await new Promise<string | null>((resolve) => {
      const svg = svgRef.current;
      if (!svg?.toDataURL) {
        resolve(null);
        return;
      }
      try {
        svg.toDataURL((data) => {
          resolve(data && data.length > 32 ? data : null);
        });
      } catch {
        resolve(null);
      }
    });
    if (fromSvg) return writePngFromBase64(fromSvg);

    if (!shotRef.current) {
      throw new Error("qr_not_ready");
    }
    // On-screen (near-invisible) capture — off-screen views often render blank on iOS.
    await new Promise((r) => setTimeout(r, 120));
    return captureRef(shotRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      width: QR_SIZE + QR_QUIET_ZONE * 2,
      height: QR_SIZE + QR_QUIET_ZONE * 2,
    });
  }, [writePngFromBase64]);

  const shareToBank = useCallback(async () => {
    setShareError(null);
    if (validateAmount() == null || !payload) {
      if (!payload && parseGiftAmountEur(amountText) != null) {
        setShareError(t("project.gift_encode_error"));
      }
      return;
    }
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setShareError(t("project.gift_share_unavailable"));
        return;
      }
      const uri = await captureQrPng();
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
  }, [amountText, captureQrPng, payload, projectNid, validateAmount]);

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

  const shareDetailsText = useCallback(async () => {
    setShareError(null);
    const parsed = validateAmount();
    if (parsed == null) return;
    const message = formatGiftPaymentDetails({
      iban: donateIban,
      amountEur: parsed,
      beneficiaryName: displayName,
    });
    try {
      await Share.share({ message });
    } catch {
      setShareError(t("project.gift_share_error"));
    }
  }, [displayName, donateIban, validateAmount]);

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

      <Pressable
        style={styles.secondaryBtn}
        onPress={() => void shareDetailsText()}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>{t("project.gift_share_details")}</Text>
      </Pressable>

      {shareError ? <Text style={styles.error}>{shareError}</Text> : null}

      {/*
        Nearly invisible but ON-SCREEN QR for capture. Off-screen (left: -N)
        views often composite blank on iOS, so banks see no payment QR.
      */}
      {payload ? (
        <View style={styles.captureHost} pointerEvents="none" collapsable={false}>
          <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
            <View style={styles.qrOnly} collapsable={false}>
              <QRCode
                value={payload}
                size={QR_SIZE}
                quietZone={QR_QUIET_ZONE}
                ecl="M"
                backgroundColor="#FFFFFF"
                color="#000000"
                getRef={(c) => {
                  svgRef.current = c;
                }}
              />
            </View>
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
            <Text style={styles.payBySquareMark}>
              {t("project.gift_pay_by_square")}
            </Text>
            {payload && amount != null ? (
              <>
                <View style={styles.qrOnly}>
                  <QRCode
                    value={payload}
                    size={QR_SIZE}
                    quietZone={QR_QUIET_ZONE}
                    ecl="M"
                    backgroundColor="#FFFFFF"
                    color="#000000"
                  />
                </View>
                <Text style={styles.qrMeta} numberOfLines={2}>
                  {displayName}
                </Text>
                <Text style={styles.qrMetaMuted} numberOfLines={1}>
                  {asciiBeneficiaryName(displayName)}
                </Text>
                <Text style={styles.qrMeta}>
                  {formatGiftAmountEur(amount)} {t("project.gift_currency")}
                </Text>
                <Text style={styles.qrIban} selectable>
                  {iban}
                </Text>
                <Text style={styles.previewHint}>{t("project.gift_preview_hint")}</Text>
              </>
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
    alignSelf: "stretch",
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
  captureHost: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0.02,
    zIndex: -1,
  },
  qrOnly: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  payBySquareMark: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: colors.ink,
  },
  qrMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  qrMetaMuted: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
  qrIban: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  previewHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
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
    gap: 10,
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    alignSelf: "stretch",
  },
});
