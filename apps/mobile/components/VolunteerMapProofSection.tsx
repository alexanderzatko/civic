import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  UrlTile,
  type MapPressEvent,
} from "react-native-maps";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import type {
  WorkReportGeoJsonGeometry,
  WorkReportGeometryType,
  WorkReportMapConfig,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchWorkReportMapConfig } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  commitDraftGeometry,
  geometrySummaryKey,
  isGeometryComplete,
  latLngRing,
  lonLatToLatLng,
  zoomToLatitudeDelta,
} from "@/lib/work-report-map";

const FALLBACK_CONFIG: WorkReportMapConfig = {
  center: { latitude: 48.7164, longitude: 19.6611 },
  zoom: 8,
  geometry_types: ["Point", "LineString", "Polygon"],
  raster_layers: [
    {
      id: "osm",
      name: "OpenStreetMap",
      url_template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      max_zoom: 19,
    },
  ],
  default_layer_id: "osm",
};

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
  const mapRef = useRef<MapView>(null);
  const [config, setConfig] = useState<WorkReportMapConfig>(FALLBACK_CONFIG);
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
        setConfig(FALLBACK_CONFIG);
        setConfigError(true);
      })
      .finally(() => setConfigLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraft([]);
    }
  }, [open]);

  const activeLayer = useMemo(() => {
    const preferred = config.default_layer_id
      ? config.raster_layers.find((l) => l.id === config.default_layer_id)
      : undefined;
    return preferred ?? config.raster_layers[0];
  }, [config]);

  const region = useMemo(() => {
    const delta = zoomToLatitudeDelta(config.zoom);
    return {
      latitude: config.center.latitude,
      longitude: config.center.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [config]);

  const onMapPress = useCallback(
    (event: MapPressEvent) => {
      if (disabled) return;
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const coord: [number, number] = [longitude, latitude];
      if (mode === "Point") {
        onChange({ type: "Point", coordinates: coord });
        setDraft([]);
        return;
      }
      setDraft((prev) => [...prev, coord]);
    },
    [disabled, mode, onChange],
  );

  const onFinishDraft = useCallback(() => {
    const committed = commitDraftGeometry(mode, draft);
    if (!committed) return;
    onChange(committed);
    setDraft([]);
  }, [draft, mode, onChange]);

  const onClear = useCallback(() => {
    setDraft([]);
    onChange(null);
  }, [onChange]);

  const onUndo = useCallback(() => {
    setDraft((prev) => prev.slice(0, -1));
  }, []);

  const onCenterMe = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, []);

  const displayGeometry = geometry;
  const draftComplete = isGeometryComplete(mode, draft);

  const summaryKey = displayGeometry
    ? `volunteer.proof_map_summary_${geometrySummaryKey(displayGeometry).toLowerCase()}`
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
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              onPress={onMapPress}
              mapType={activeLayer ? "none" : "standard"}
            >
              {activeLayer ? (
                <UrlTile
                  urlTemplate={activeLayer.url_template}
                  maximumZ={activeLayer.max_zoom ?? 19}
                  zIndex={-1}
                />
              ) : null}

              {displayGeometry?.type === "Point" ? (
                <Marker coordinate={lonLatToLatLng(displayGeometry.coordinates)} />
              ) : null}

              {displayGeometry?.type === "LineString" ? (
                <Polyline
                  coordinates={latLngRing(displayGeometry.coordinates)}
                  strokeColor={colors.brand}
                  strokeWidth={3}
                />
              ) : null}

              {displayGeometry?.type === "Polygon" ? (
                <Polygon
                  coordinates={latLngRing(displayGeometry.coordinates[0] ?? [])}
                  strokeColor={colors.brand}
                  fillColor="rgba(11, 61, 46, 0.25)"
                  strokeWidth={2}
                />
              ) : null}

              {draft.length > 0 && mode === "Point" ? (
                <Marker coordinate={lonLatToLatLng(draft[0])} />
              ) : null}

              {draft.length > 0 && mode === "LineString" ? (
                <Polyline
                  coordinates={latLngRing(draft)}
                  strokeColor={colors.brandSoft}
                  strokeWidth={3}
                  lineDashPattern={[8, 6]}
                />
              ) : null}

              {draft.length > 0 && mode === "Polygon" ? (
                <Polygon
                  coordinates={latLngRing(draft)}
                  strokeColor={colors.brandSoft}
                  fillColor="rgba(26, 92, 69, 0.2)"
                  strokeWidth={2}
                />
              ) : null}
            </MapView>
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
            {mode !== "Point" && draft.length > 0 ? (
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

          {summaryKey && displayGeometry ? (
            <Text style={styles.summary}>{t(summaryKey)}</Text>
          ) : null}
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
  map: { width: "100%", height: 260 },
  attribution: { color: colors.muted, fontSize: 11 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  toolBtn: { paddingVertical: 4 },
  toolText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  removeText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  summary: { color: colors.ink, fontSize: 13, fontWeight: "600" },
});
