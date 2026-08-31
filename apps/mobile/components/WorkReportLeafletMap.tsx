import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type {
  WorkReportGeoJsonGeometry,
  WorkReportGeometryType,
  WorkReportMapConfig,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { buildWorkReportLeafletHtml } from "@/lib/work-report-leaflet-html";
import { pickActiveRasterLayer } from "@/lib/work-report-map-config";

export type WorkReportLeafletMapRef = {
  flyTo: (latitude: number, longitude: number, zoom?: number) => void;
};

type Props = {
  config: WorkReportMapConfig;
  height: number;
  interactive?: boolean;
  disabled?: boolean;
  mode?: WorkReportGeometryType;
  geometry?: WorkReportGeoJsonGeometry | null;
  draft?: [number, number][];
  fitGeometry?: boolean;
  onPress?: (coord: [number, number]) => void;
};

type SyncPayload = {
  type: "sync";
  interactive: boolean;
  disabled: boolean;
  mode: WorkReportGeometryType;
  geometry: WorkReportGeoJsonGeometry | null;
  draft: [number, number][];
  fitGeometry: boolean;
};

export const WorkReportLeafletMap = forwardRef<WorkReportLeafletMapRef, Props>(
  function WorkReportLeafletMap(
    {
      config,
      height,
      interactive = false,
      disabled = false,
      mode = "Point",
      geometry = null,
      draft = [],
      fitGeometry = false,
      onPress,
    },
    ref,
  ) {
    const webRef = useRef<WebView>(null);
    const [ready, setReady] = useState(false);
    const activeLayer = useMemo(() => pickActiveRasterLayer(config), [config]);

    const html = useMemo(() => {
      const layer = activeLayer;
      return buildWorkReportLeafletHtml({
        tileUrl: layer?.url_template ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maxZoom: layer?.max_zoom ?? 19,
        centerLat: config.center.latitude,
        centerLon: config.center.longitude,
        zoom: config.zoom,
        brand: colors.brand,
        brandSoft: colors.brandSoft,
      });
    }, [activeLayer, config.center.latitude, config.center.longitude, config.zoom]);

    const mapKey = `${activeLayer?.id ?? "default"}-${activeLayer?.url_template ?? ""}-${config.center.latitude}-${config.zoom}`;

    const syncPayload = useMemo<SyncPayload>(
      () => ({
        type: "sync",
        interactive,
        disabled,
        mode,
        geometry,
        draft,
        fitGeometry,
      }),
      [interactive, disabled, mode, geometry, draft, fitGeometry],
    );

    const postToMap = useCallback((payload: object) => {
      webRef.current?.postMessage(JSON.stringify(payload));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        flyTo(latitude: number, longitude: number, zoom = 14) {
          postToMap({ type: "flyTo", latitude, longitude, zoom });
        },
      }),
      [postToMap],
    );

    useEffect(() => {
      setReady(false);
    }, [mapKey]);

    useEffect(() => {
      if (!ready) return;
      postToMap(syncPayload);
    }, [ready, syncPayload, postToMap]);

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data) as {
            type: string;
            longitude?: number;
            latitude?: number;
          };
          if (msg.type === "ready") {
            setReady(true);
            return;
          }
          if (
            msg.type === "press" &&
            typeof msg.longitude === "number" &&
            typeof msg.latitude === "number"
          ) {
            onPress?.([msg.longitude, msg.latitude]);
          }
        } catch {
          // ignore malformed bridge messages
        }
      },
      [onPress],
    );

    if (Platform.OS === "web") {
      return <View style={[styles.map, { height }]} />;
    }

    return (
      <WebView
        key={mapKey}
        ref={webRef}
        source={{ html }}
        style={[styles.map, { height }]}
        onMessage={onMessage}
        scrollEnabled={false}
        nestedScrollEnabled
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
      />
    );
  },
);

const styles = StyleSheet.create({
  map: {
    width: "100%",
    backgroundColor: colors.bg,
  },
});
