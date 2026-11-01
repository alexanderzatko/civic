import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import type {
  WorkReportGeoJsonGeometry,
  WorkReportGeometryType,
  WorkReportMapConfig,
} from "@civic/shared";
import {
  WorkReportLeafletMap,
  type WorkReportLeafletMapRef,
} from "@/components/WorkReportLeafletMap";
import { colors } from "@/constants/theme";
import { fetchWorkReportMapConfig } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  FALLBACK_WORK_REPORT_MAP_CONFIG,
  pickActiveRasterLayer,
} from "@/lib/work-report-map-config";
import {
  appendGeometry,
  commitDraftGeometry,
  geometryFeatureCount,
  geometrySummaryKey,
  isGeometryComplete,
  popGeometry,
} from "@/lib/work-report-map";

type Props = {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  geometry: WorkReportGeoJsonGeometry | null;
  onChange: (geometry: WorkReportGeoJsonGeometry | null) => void;
};

const MODE_LABEL_KEYS: Record<WorkReportGeometryType, string> = {
  Point: "volunteer.proof_map_point",
  LineString: "volunteer.proof_map_line",
  Polygon: "volunteer.proof_map_polygon",
};

const MODE_HINT_KEYS: Record<WorkReportGeometryType, string> = {
  Point: "volunteer.proof_map_hint_point",
  LineString: "volunteer.proof_map_hint_line",
  Polygon: "volunteer.proof_map_hint_polygon",
};

export function VolunteerMapProofSection({
  open,
  onToggle,
  disabled = false,
  geometry,
  onChange,
}: Props) {
  const mapRef = useRef<WorkReportLeafletMapRef>(null);
  const [config, setConfig] = useState<WorkReportMapConfig>(
    FALLBACK_WORK_REPORT_MAP_CONFIG,
  );
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [mode, setMode] = useState<WorkReportGeometryType>("Point");
  const [draft, setDraft] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!open) return;
    setConfigLoading(true);
    setConfigError(false);
    void fetchWorkReportMapConfig()
      .then((res) => {
        setConfig(res);
        const first = res.geometry_types[0];
        if (first) setMode(first);
      })
      .catch(() => {
        setConfig(FALLBACK_WORK_REPORT_MAP_CONFIG);
        setConfigError(true);
      })
      .finally(() => setConfigLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraft([]);
    }
  }, [open]);

  const activeLayer = pickActiveRasterLayer(config);

  const onMapPress = useCallback(
    (coord: [number, number]) => {
      if (disabled) return;
      if (mode === "Point") {
        onChange(appendGeometry(geometry, { type: "Point", coordinates: coord }));
        setDraft([]);
        return;
      }
      setDraft((prev) => [...prev, coord]);
    },
    [disabled, geometry, mode, onChange],
  );

  const onFinishDraft = useCallback(() => {
    const committed = commitDraftGeometry(mode, draft);
    if (!committed) return;
    onChange(appendGeometry(geometry, committed));
    setDraft([]);
  }, [draft, geometry, mode, onChange]);

  const onClear = useCallback(() => {
    setDraft([]);
    onChange(null);
  }, [onChange]);

  const onUndo = useCallback(() => {
    if (draft.length > 0) {
      setDraft((prev) => prev.slice(0, -1));
      return;
    }
    onChange(popGeometry(geometry));
  }, [draft.length, geometry, onChange]);

  const onCenterMe = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    mapRef.current?.flyTo(pos.coords.latitude, pos.coords.longitude);
  }, []);

  const draftComplete = isGeometryComplete(mode, draft);
  const featureCount = geometry ? geometryFeatureCount(geometry) : 0;
  const canUndo = draft.length > 0 || featureCount > 0;

  const summaryKey = geometry ? geometrySummaryKey(geometry) : null;
  const summary =
    geometry && summaryKey
      ? t(`volunteer.proof_map_summary_${summaryKey.toLowerCase()}`).replace(
          "{{count}}",
          String(featureCount),
        )
      : null;

  if (Platform.OS === "web") {
    return (
      <View>
        <Pressable
          style={styles.toggle}
          onPress={onToggle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <MaterialIcons name="map" size={18} color={colors.brand} style={styles.icon} />
          <Text style={[styles.link, disabled && styles.linkDisabled]}>
            {t("volunteer.proof_map")}
          </Text>
        </Pressable>
        {open ? (
          <Text style={styles.hint}>{t("volunteer.proof_map_web_unavailable")}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Pressable
        style={styles.toggle}
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <MaterialIcons name="map" size={18} color={colors.brand} style={styles.icon} />
        <Text style={[styles.link, disabled && styles.linkDisabled]}>
          {t("volunteer.proof_map")}
        </Text>
        {geometry ? (
          <Text style={styles.badge}>{t("volunteer.proof_map_added")}</Text>
        ) : null}
      </Pressable>

      {open ? (
        <View style={styles.box}>
          <Text style={styles.hint}>{t("volunteer.proof_map_intro")}</Text>
          {configLoading ? (
            <ActivityIndicator color={colors.brand} />
          ) : null}
          {configError ? (
            <Text style={styles.warn}>{t("volunteer.proof_map_config_fallback")}</Text>
          ) : null}

          <View style={styles.modeRow}>
            {config.geometry_types.map((type) => (
              <Pressable
                key={type}
                style={[styles.modeBtn, mode === type && styles.modeBtnOn]}
                onPress={() => {
                  setMode(type);
                  setDraft([]);
                }}
                disabled={disabled}
              >
                <Text
                  style={[styles.modeText, mode === type && styles.modeTextOn]}
                >
                  {t(MODE_LABEL_KEYS[type])}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>{t(MODE_HINT_KEYS[mode])}</Text>

          <View style={styles.mapShell}>
            <WorkReportLeafletMap
              ref={mapRef}
              config={config}
              height={260}
              interactive
              disabled={disabled}
              mode={mode}
              geometry={geometry}
              draft={draft}
              onPress={onMapPress}
            />
          </View>

          {activeLayer?.attribution ? (
            <Text style={styles.attribution}>{activeLayer.attribution}</Text>
          ) : null}

          <View style={styles.toolRow}>
            <Pressable
              style={styles.toolBtn}
              onPress={() => void onCenterMe()}
              disabled={disabled}
            >
              <Text style={styles.toolText}>{t("volunteer.proof_map_center_me")}</Text>
            </Pressable>
            {canUndo ? (
              <Pressable style={styles.toolBtn} onPress={onUndo} disabled={disabled}>
                <Text style={styles.toolText}>{t("volunteer.proof_map_undo")}</Text>
              </Pressable>
            ) : null}
            {mode !== "Point" && draftComplete ? (
              <Pressable style={styles.toolBtn} onPress={onFinishDraft} disabled={disabled}>
                <Text style={styles.toolText}>{t("volunteer.proof_map_finish")}</Text>
              </Pressable>
            ) : null}
            {geometry || draft.length > 0 ? (
              <Pressable style={styles.toolBtn} onPress={onClear} disabled={disabled}>
                <Text style={styles.removeText}>{t("volunteer.proof_map_clear")}</Text>
              </Pressable>
            ) : null}
          </View>

          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 2,
    gap: 6,
  },
  icon: { marginRight: 0 },
  link: { color: colors.brand, fontWeight: "700", flex: 1 },
  linkDisabled: { opacity: 0.5 },
  badge: {
    color: colors.ok,
    fontSize: 12,
    fontWeight: "700",
  },
  box: { gap: 10, marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.muted, fontSize: 12 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  modeBtnOn: {
    borderColor: colors.brand,
    backgroundColor: "#E8EFEA",
  },
  modeText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  modeTextOn: { color: colors.brand },
  mapShell: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  attribution: { color: colors.muted, fontSize: 11 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  toolBtn: { paddingVertical: 4 },
  toolText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  removeText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  summary: { color: colors.ink, fontSize: 13, fontWeight: "600" },
});
