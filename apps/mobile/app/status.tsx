import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchHealth, type HealthResponse } from "@/lib/api";
import { getAppVersionParts } from "@/lib/app-version";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

type RowState = "ok" | "fail" | "unknown" | "loading";

function StatusChip({ state }: { state: RowState }) {
  const label =
    state === "ok"
      ? t("status.chip_ok")
      : state === "fail"
        ? t("status.chip_fail")
        : state === "loading"
          ? t("status.chip_checking")
          : t("status.chip_unknown");
  const bg =
    state === "ok"
      ? colors.catCharitySoft
      : state === "fail"
        ? "rgba(155, 44, 44, 0.14)"
        : colors.border;
  const fg =
    state === "ok"
      ? colors.ok
      : state === "fail"
        ? colors.danger
        : colors.muted;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function StatusRow({ label, state }: { label: string; state: RowState }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <StatusChip state={state} />
    </View>
  );
}

export default function StatusScreen() {
  useLocale();
  const { status: authStatus } = useAuth();
  const { version, build } = getAppVersionParts();

  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [civicError, setCivicError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setCivicError(null);
    try {
      const result = await fetchHealth();
      setHealth(result.data);
      setCivicError(result.error);
    } finally {
      setChecking(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void runChecks();
    }, [runChecks]),
  );

  const sessionState: RowState =
    authStatus === "loading"
      ? "loading"
      : authStatus === "signedIn"
        ? "ok"
        : "unknown";

  const civicState: RowState = checking
    ? "loading"
    : civicError || !health
      ? "fail"
      : health.civic_api?.ok !== false
        ? "ok"
        : "fail";

  const rovasState: RowState = checking
    ? "loading"
    : !health
      ? "unknown"
      : health.rovas?.ok
        ? "ok"
        : "fail";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t("status.intro")}</Text>

      <StatusRow label={t("status.check_session")} state={sessionState} />
      <StatusRow label={t("status.check_civic")} state={civicState} />
      <StatusRow label={t("status.check_rovas")} state={rovasState} />

      <View style={styles.metaBlock}>
        <Text style={styles.metaLabel}>{t("status.app_build")}</Text>
        <Text style={styles.metaValue}>
          {t("about.version")
            .replace("{{version}}", version)
            .replace("{{build}}", build)}
        </Text>
      </View>

      <Pressable
        style={[styles.refreshBtn, checking && styles.refreshDisabled]}
        onPress={() => {
          void runChecks();
        }}
        disabled={checking}
        accessibilityRole="button"
        accessibilityLabel={t("status.refresh")}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.refreshText}>{t("status.refresh")}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 48 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#fff",
  },
  rowLabel: { flex: 1, fontWeight: "700", color: colors.ink, fontSize: 15 },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  metaBlock: { gap: 4, marginTop: 8 },
  metaLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  metaValue: { color: colors.ink, fontSize: 14, marginBottom: 8 },
  refreshBtn: {
    marginTop: 8,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  refreshDisabled: { opacity: 0.7 },
  refreshText: { color: "#fff", fontWeight: "700" },
});
