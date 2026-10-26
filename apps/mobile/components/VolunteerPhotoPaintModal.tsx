import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { PHOTO_PAINT_HTML } from "@/lib/photo-paint-html";
import {
  applyPaintedVolunteerPhoto,
  type VolunteerPhotoDraft,
} from "@/lib/pick-volunteer-photo";

function paintSrcFileName(mime: string): string {
  if (mime === "image/png") return "civic-volunteer-paint-src.png";
  if (mime === "image/webp") return "civic-volunteer-paint-src.webp";
  return "civic-volunteer-paint-src.jpg";
}

const BRUSH_PRESETS = [8, 24, 48, 72] as const;

type Props = {
  photo: VolunteerPhotoDraft | null;
  visible: boolean;
  onCancel: () => void;
  onApply: (photo: VolunteerPhotoDraft) => void;
};

type PaintStatus = "boot" | "loading" | "ready" | "error" | "saving";

type HostMessage =
  | { type: "status"; status: PaintStatus | "boot" }
  | { type: "undoState"; canUndo: boolean }
  | { type: "export"; ok: true; data: string }
  | { type: "export"; ok: false };

function postToPaint(web: WebView | null, payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  // Prefer WebView.postMessage; fall back to injected dispatch for older bridges.
  const wv = web as WebView & { postMessage?: (s: string) => void };
  if (typeof wv?.postMessage === "function") {
    wv.postMessage(json);
    return;
  }
  web?.injectJavaScript(
    `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(json)}})); true;`,
  );
}

export function VolunteerPhotoPaintModal({
  photo,
  visible,
  onCancel,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [status, setStatus] = useState<PaintStatus>("boot");
  const [canUndo, setCanUndo] = useState(false);
  const [brush, setBrush] = useState(24);
  const [straighten, setStraighten] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brushRef = useRef(brush);
  const straightenRef = useRef(straighten);
  brushRef.current = brush;
  straightenRef.current = straighten;

  const resetUi = useCallback(() => {
    setStatus("boot");
    setCanUndo(false);
    setBrush(24);
    setStraighten(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible) resetUi();
  }, [visible, resetUi]);

  const cacheBaseUrl = (() => {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return undefined;
    return Platform.OS === "android" && !dir.startsWith("file://")
      ? `file://${dir}`
      : dir;
  })();

  const loadImage = useCallback(async () => {
    if (!photo || !FileSystem.cacheDirectory) return;
    setStatus("loading");
    setError(null);
    try {
      const name = paintSrcFileName(photo.mime || "image/jpeg");
      const path = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(path, photo.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Relative to WebView baseUrl (cache dir) — avoids huge bridge payloads.
      postToPaint(webRef.current, { type: "load", src: name });
    } catch {
      setStatus("error");
      setError(t("volunteer.paint_load_error"));
    }
  }, [photo]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: HostMessage;
      try {
        msg = JSON.parse(event.nativeEvent.data) as HostMessage;
      } catch {
        return;
      }
      if (msg.type === "status") {
        if (msg.status === "boot") {
          setStatus("boot");
          void loadImage();
          return;
        }
        if (msg.status === "loading") {
          setStatus("loading");
          return;
        }
        if (msg.status === "ready") {
          setStatus("ready");
          postToPaint(webRef.current, {
            type: "setBrush",
            value: brushRef.current,
          });
          postToPaint(webRef.current, {
            type: "setStraighten",
            value: straightenRef.current,
          });
          return;
        }
        if (msg.status === "error") {
          setStatus("error");
          setError(t("volunteer.paint_load_error"));
        }
        return;
      }
      if (msg.type === "undoState") {
        setCanUndo(msg.canUndo);
        return;
      }
      if (msg.type === "export") {
        if (!msg.ok || !("data" in msg) || !photo) {
          setStatus("ready");
          setError(t("volunteer.paint_save_error"));
          return;
        }
        void (async () => {
          try {
            const next = await applyPaintedVolunteerPhoto(photo, msg.data);
            onApply(next);
          } catch {
            setStatus("ready");
            setError(t("volunteer.paint_save_error"));
          }
        })();
      }
    },
    [loadImage, onApply, photo],
  );

  const onBrush = (n: number) => {
    setBrush(n);
    postToPaint(webRef.current, { type: "setBrush", value: n });
  };

  const onStraighten = (v: boolean) => {
    setStraighten(v);
    postToPaint(webRef.current, { type: "setStraighten", value: v });
  };

  const onApplyPress = () => {
    if (status !== "ready") return;
    setStatus("saving");
    setError(null);
    postToPaint(webRef.current, { type: "export" });
  };

  const busy = status === "loading" || status === "saving" || status === "boot";
  const paintReady = status === "ready";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.toolbar}>
          <Text style={styles.title}>{t("volunteer.paint_title")}</Text>
          <Text style={styles.brushLabel}>{t("volunteer.paint_brush")}</Text>
          <View style={styles.brushRow}>
            {BRUSH_PRESETS.map((n) => {
              const selected = brush === n;
              return (
                <Pressable
                  key={n}
                  style={[styles.brushChip, selected && styles.brushChipOn]}
                  onPress={() => onBrush(n)}
                  disabled={!paintReady}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.brushDot,
                      {
                        width: Math.max(8, n / 3),
                        height: Math.max(8, n / 3),
                      },
                      selected && styles.brushDotOn,
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.straightRow}>
            <Switch
              value={straighten}
              onValueChange={onStraighten}
              disabled={!paintReady}
              trackColor={{ false: colors.border, true: colors.brandSoft }}
            />
            <Text style={styles.straightLabel}>
              {t("volunteer.paint_straight")}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={styles.toolBtn}
              onPress={() => postToPaint(webRef.current, { type: "undo" })}
              disabled={!paintReady || !canUndo}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.toolBtnText,
                  (!paintReady || !canUndo) && styles.toolBtnDisabled,
                ]}
              >
                {t("volunteer.paint_undo")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.toolBtn}
              onPress={() => postToPaint(webRef.current, { type: "clear" })}
              disabled={!paintReady || !canUndo}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.toolBtnText,
                  (!paintReady || !canUndo) && styles.toolBtnDisabled,
                ]}
              >
                {t("volunteer.paint_clear")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.canvasWrap}>
          {visible ? (
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{
                html: PHOTO_PAINT_HTML,
                ...(cacheBaseUrl ? { baseUrl: cacheBaseUrl } : {}),
              }}
              onMessage={onMessage}
              style={styles.webview}
              scrollEnabled={false}
              bounces={false}
              setSupportMultipleWindows={false}
              javaScriptEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowingReadAccessToURL={cacheBaseUrl}
            />
          ) : null}
          {busy ? (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.overlayText}>
                {status === "saving"
                  ? t("volunteer.paint_saving")
                  : t("volunteer.paint_loading")}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={status === "saving"}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t("volunteer.paint_cancel")}</Text>
          </Pressable>
          <Pressable
            style={[styles.applyBtn, !paintReady && styles.applyBtnDisabled]}
            onPress={onApplyPress}
            disabled={!paintReady}
            accessibilityRole="button"
          >
            <Text style={styles.applyText}>{t("volunteer.paint_apply")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  brushLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  brushRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  brushChip: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  brushChipOn: {
    borderColor: colors.brand,
    backgroundColor: "rgba(26, 92, 69, 0.12)",
  },
  brushDot: {
    borderRadius: 99,
    backgroundColor: colors.ink,
  },
  brushDotOn: {
    backgroundColor: colors.brand,
  },
  straightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  straightLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
  },
  toolBtn: {
    paddingVertical: 4,
  },
  toolBtnText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 14,
  },
  toolBtnDisabled: {
    color: colors.muted,
    opacity: 0.5,
  },
  canvasWrap: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  overlayText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: {
    color: colors.ink,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyText: {
    color: "#fff",
    fontWeight: "700",
  },
});
