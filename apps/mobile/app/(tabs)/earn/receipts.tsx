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
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
  displayMerits,
  type VerifiedReceiptPreview,
  type VerifyReceiptResponse,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { verifyReceipt } from "@/lib/api";
import { t } from "@/lib/i18n";

type ScanBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function ReceiptsScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [uidInput, setUidInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<VerifiedReceiptPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedLock, setScannedLock] = useState(false);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [scanBounds, setScanBounds] = useState<ScanBounds | null>(null);

  const runVerify = useCallback(async (qrOrUid: string) => {
    setBusy(true);
    setError(null);
    setPreview(null);
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
        // Stop the camera so a failed scan doesn't re-fire in a loop.
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

  const showScanner = scanning && permission?.granted;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t("receipts.intro")}</Text>

      <Pressable style={styles.primary} onPress={startScan} disabled={busy}>
        <Text style={styles.primaryText}>{t("receipts.scan")}</Text>
      </Pressable>

      {showScanner ? (
        <View style={styles.cameraWrap} onLayout={onCameraLayout}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            // Disable further callbacks while verifying — prevents the flash loop.
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
        style={[styles.primary, busy && styles.disabled]}
        disabled={busy || !uidInput.trim()}
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
          <Text style={styles.soon}>{t("receipts.claim_soon")}</Text>
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
  soon: { marginTop: 4, color: colors.brandSoft, fontWeight: "600" },
  empty: { color: colors.muted, marginTop: 12 },
});
