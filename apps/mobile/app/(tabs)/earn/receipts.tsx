import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Link } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Location from "expo-location";
import {
  displayMerits,
  type ClaimReceiptResponse,
  type VerifiedReceiptPreview,
  type VerifyReceiptResponse,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { claimReceipt, verifyReceipt } from "@/lib/api";
import { notifyMeritsChanged } from "@/lib/merits-refresh";
import { t } from "@/lib/i18n";

type ScanBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function ReceiptsScreen() {
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "signedIn";
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [uidInput, setUidInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [preview, setPreview] = useState<VerifiedReceiptPreview | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimReceiptResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [scannedLock, setScannedLock] = useState(false);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [scanBounds, setScanBounds] = useState<ScanBounds | null>(null);

  const runVerify = useCallback(async (qrOrUid: string) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setClaimResult(null);
    try {
      const result: VerifyReceiptResponse = await verifyReceipt(qrOrUid);
      if (result.verified) {
        setPreview(result);
        setUidInput(result.receipt_uid);
        setScanning(false);
        setScanBounds(null);
      } else {
        const map: Record<string, string> = {
          invalid_uid: t("receipts.error_invalid"),
          not_found: t("receipts.error_not_found"),
          fs_error: t("receipts.error_fs"),
          offline_unsupported: t("receipts.error_fs"),
        };
        setError(map[result.code] ?? result.message);
        setScanning(false);
        setScanBounds(null);
      }
    } catch {
      setError(t("receipts.error_api"));
      setScanning(false);
      setScanBounds(null);
    } finally {
      setBusy(false);
      setScannedLock(false);
    }
  }, []);

  async function startScan() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setError(null);
    setClaimResult(null);
    setScannedLock(false);
    setScanBounds(null);
    setScanning(true);
  }

  function onCameraLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setCameraSize({ width, height });
  }

  function onBarcodeScanned(result: BarcodeScanningResult) {
    if (scannedLock || busy) return;
    setScannedLock(true);
    setScanBounds(boundsFromScan(result, cameraSize.width, cameraSize.height));
    void runVerify(result.data);
  }

  async function runClaim() {
    if (!preview) return;
    setClaiming(true);
    setError(null);
    setClaimResult(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(t("receipts.error_location"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await claimReceipt(preview.receipt_uid, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m:
          pos.coords.accuracy != null ? pos.coords.accuracy : undefined,
      });
      setClaimResult(result);
      if (result.claimed) {
        notifyMeritsChanged();
      } else {
        const map: Record<string, string> = {
          unauthorized: t("receipts.error_unauthorized"),
          invalid_uid: t("receipts.error_invalid"),
          not_found: t("receipts.error_not_found"),
          fs_error: t("receipts.error_fs"),
          duplicate: t("receipts.error_duplicate"),
          rejected_location: t("receipts.error_location"),
          rejected_window: t("receipts.error_window"),
          rejected_rate: t("receipts.error_rate"),
          rejected_vat: t("receipts.error_vat"),
          rejected_shares: t("receipts.error_rovas"),
          rovas_error: t("receipts.error_rovas"),
          offline_unsupported: t("receipts.error_fs"),
        };
        setError(map[result.code] ?? result.message);
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        setError(t("receipts.error_unauthorized"));
      } else {
        setError(t("receipts.error_api"));
      }
    } finally {
      setClaiming(false);
    }
  }

  const showScanner = scanning && permission?.granted;
  const claimSucceeded = claimResult?.claimed === true;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t("receipts.intro")}</Text>

      <Pressable style={styles.primary} onPress={startScan} disabled={busy || claiming}>
        <Text style={styles.primaryText}>{t("receipts.scan")}</Text>
      </Pressable>

      {showScanner ? (
        <View style={styles.cameraWrap} onLayout={onCameraLayout}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scannedLock || busy ? undefined : onBarcodeScanned}
          />
          <ViewfinderOverlay highlight={scanBounds} verifying={busy} />
          <Pressable
            style={styles.cancelScan}
            onPress={() => {
              setScanning(false);
              setScanBounds(null);
              setScannedLock(false);
            }}
          >
            <Text style={styles.cancelText}>{t("common.back")}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>{t("receipts.manual")}</Text>
      <TextInput
        value={uidInput}
        onChangeText={setUidInput}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t("receipts.uid_placeholder")}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Pressable
        style={[styles.primary, (busy || claiming) && styles.disabled]}
        disabled={busy || claiming || !uidInput.trim()}
        onPress={() => void runVerify(uidInput)}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t("receipts.verify")}</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{t("receipts.preview_title")}</Text>
          <Row label={t("receipts.merchant")} value={preview.merchant_name ?? "—"} />
          <Row
            label={t("receipts.vat")}
            value={`${preview.vat_eur.toFixed(2)} ${t("common.eur")}`}
          />
          <Row
            label={t("receipts.merits")}
            value={`${displayMerits(preview.merits_preview)} ${t("common.me")}`}
          />
          <Text style={styles.hint}>
            {preview.merits_preview.toFixed(2)} ME · {preview.wage_basis} · v
            {preview.formula_version}
          </Text>

          {claimSucceeded ? (
            <Text style={styles.success}>
              {t("receipts.claim_success")}{" "}
              ({displayMerits(claimResult.total_merits)} {t("common.me")})
            </Text>
          ) : signedIn ? (
            <Pressable
              style={[styles.primary, claiming && styles.disabled]}
              disabled={claiming}
              onPress={() => void runClaim()}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{t("receipts.claim")}</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.signInPrompt}>
              <Text style={styles.hint}>{t("receipts.claim_sign_in")}</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.secondary}>
                  <Text style={styles.secondaryText}>{t("home.sign_in")}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.empty}>{t("receipts.history_empty")}</Text>
      )}
    </ScrollView>
  );
}

function ViewfinderOverlay({
  highlight,
  verifying,
}: {
  highlight: ScanBounds | null;
  verifying: boolean;
}) {
  const frame = 200;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.maskCenter}>
        <View style={[styles.frame, { width: frame, height: frame }]}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.scanHint}>{t("receipts.scan_hint")}</Text>
        {verifying ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.verifyingText}>{t("receipts.verifying")}</Text>
          </View>
        ) : null}
      </View>
      {highlight ? (
        <View
          style={[
            styles.detectedBox,
            {
              left: highlight.left,
              top: highlight.top,
              width: highlight.width,
              height: highlight.height,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Map barcode bounds into the CameraView layout when the engine provides them. */
function boundsFromScan(
  result: BarcodeScanningResult,
  viewW: number,
  viewH: number,
): ScanBounds | null {
  if (!viewW || !viewH) return null;

  const corners = result.cornerPoints;
  if (corners && corners.length >= 4) {
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // cornerPoints are often already in view coordinates on native;
    // clamp so a mis-scaled engine still draws something sensible.
    const left = clamp(minX, 0, viewW);
    const top = clamp(minY, 0, viewH);
    const width = clamp(maxX - minX, 0, viewW - left);
    const height = clamp(maxY - minY, 0, viewH - top);
    if (width < 8 || height < 8) return null;
    return { left, top, width, height };
  }

  const b = result.bounds;
  if (b?.size && b.origin) {
    const left = clamp(b.origin.x, 0, viewW);
    const top = clamp(b.origin.y, 0, viewH);
    const width = clamp(b.size.width, 0, viewW - left);
    const height = clamp(b.size.height, 0, viewH - top);
    if (width < 8 || height < 8) return null;
    return { left, top, width, height };
  }

  return null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const CORNER = 28;
const STROKE = 3;

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 48 },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: 4,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  label: { marginTop: 8, color: colors.muted, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  cameraWrap: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: { flex: 1 },
  maskCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  frame: {
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#fff",
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
  },
  scanHint: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verifyingText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  detectedBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 8,
    backgroundColor: "rgba(196,163,90,0.15)",
  },
  cancelScan: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelText: { color: "#fff", fontWeight: "600" },
  error: { color: colors.danger, fontWeight: "600" },
  preview: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  previewTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  hint: { fontSize: 12, color: colors.muted },
  success: { marginTop: 4, color: colors.ok, fontWeight: "700" },
  signInPrompt: { gap: 8, marginTop: 4 },
  secondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  secondaryText: { color: colors.brandSoft, fontWeight: "700", fontSize: 15 },
  empty: { color: colors.muted, marginTop: 12 },
});
