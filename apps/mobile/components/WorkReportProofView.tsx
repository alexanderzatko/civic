import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { WorkReportDetail, WorkReportMapConfig } from "@civic/shared";
import { WorkReportLeafletMap } from "@/components/WorkReportLeafletMap";
import { colors } from "@/constants/theme";
import { fetchWorkReportMapConfig } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  FALLBACK_WORK_REPORT_MAP_CONFIG,
  pickActiveRasterLayer,
} from "@/lib/work-report-map-config";

type Props = {
  report: WorkReportDetail;
};

export function WorkReportProofView({ report }: Props) {
  const webUrls = report.web_urls ?? [];
  const geometry = report.field_location ?? null;
  const [config, setConfig] = useState<WorkReportMapConfig>(
    FALLBACK_WORK_REPORT_MAP_CONFIG,
  );
  const [loading, setLoading] = useState(Boolean(geometry));

  useEffect(() => {
    if (!geometry) return;
    setLoading(true);
    void fetchWorkReportMapConfig()
      .then(setConfig)
      .catch(() => setConfig(FALLBACK_WORK_REPORT_MAP_CONFIG))
      .finally(() => setLoading(false));
  }, [geometry]);

  const activeLayer = pickActiveRasterLayer(config);

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
            <View style={styles.mapShell}>
              <WorkReportLeafletMap
                config={config}
                height={220}
                geometry={geometry}
                fitGeometry
              />
            </View>
          )}
          {activeLayer?.attribution ? (
            <Text style={styles.attribution}>{activeLayer.attribution}</Text>
          ) : null}
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
  mapShell: {
    borderRadius: 10,
    overflow: "hidden",
  },
  attribution: { color: colors.muted, fontSize: 11 },
});
