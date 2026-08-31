import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
} from "react-native-maps";
import type { WorkReportDetail, WorkReportMapConfig } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchWorkReportMapConfig } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
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
  report: WorkReportDetail;
};

export function WorkReportProofView({ report }: Props) {
  const webUrls = report.web_urls ?? [];
  const geometry = report.field_location ?? null;
  const [config, setConfig] = useState<WorkReportMapConfig>(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(Boolean(geometry));

  useEffect(() => {
    if (!geometry) return;
    setLoading(true);
    void fetchWorkReportMapConfig()
      .then(setConfig)
      .catch(() => setConfig(FALLBACK_CONFIG))
      .finally(() => setLoading(false));
  }, [geometry]);

  const activeLayer = useMemo(() => {
    const preferred = config.default_layer_id
      ? config.raster_layers.find((l) => l.id === config.default_layer_id)
      : undefined;
    return preferred ?? config.raster_layers[0];
  }, [config]);

  const mapRegion = useMemo(() => {
    if (!geometry) {
      const delta = zoomToLatitudeDelta(config.zoom);
      return {
        latitude: config.center.latitude,
        longitude: config.center.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
    }
    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates as [number, number];
      return {
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    const delta = zoomToLatitudeDelta(config.zoom);
    return {
      latitude: config.center.latitude,
      longitude: config.center.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [config, geometry]);

  if (webUrls.length === 0 && !geometry) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {webUrls.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t("volunteer.proof_url")}</Text>
          {webUrls.map((url) => (
            <Pressable
              key={url}
              onPress={() => void Linking.openURL(url)}
              accessibilityRole="link"
            >
              <Text style={styles.link} numberOfLines={2}>
                {url}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {geometry && Platform.OS !== "web" ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t("volunteer.proof_map")}</Text>
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <MapView style={styles.map} region={mapRegion} scrollEnabled zoomEnabled>
              {activeLayer ? (
                <UrlTile
                  urlTemplate={activeLayer.url_template}
                  maximumZ={activeLayer.max_zoom ?? 19}
                />
              ) : null}
              {geometry.type === "Point" ? (
                <Marker coordinate={lonLatToLatLng(geometry.coordinates as [number, number])} />
              ) : null}
              {geometry.type === "LineString" ? (
                <Polyline
                  coordinates={(geometry.coordinates as [number, number][]).map(lonLatToLatLng)}
                  strokeColor={colors.brand}
                  strokeWidth={3}
                />
              ) : null}
              {geometry.type === "Polygon" ? (
                <Polygon
                  coordinates={latLngRing(
                    (geometry.coordinates as [number, number][][])[0] ?? [],
                  )}
                  strokeColor={colors.brand}
                  fillColor="rgba(11, 61, 46, 0.25)"
                  strokeWidth={2}
                />
              ) : null}
            </MapView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  block: { gap: 8 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  link: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  map: {
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
  },
});
