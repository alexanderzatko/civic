import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Linking } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type {
  SubmitVerificationErrorCode,
  SubmitVerificationResponse,
  VerificationVerdict,
  WorkReportDetail,
} from "@civic/shared";
import { WorkReportProofView } from "@/components/WorkReportProofView";
import { colors } from "@/constants/theme";
import { fetchWorkReportDetail, submitVerification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { formatDurationHoursMinutes } from "@/lib/format-duration";
import {
  isVerificationSlotCompleted,
  markVerificationCompleted,
  refreshPendingVerifications,
} from "@/lib/pending-verifications";

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sk-SK");
}

function verifyErrorCopy(code: SubmitVerificationErrorCode | string): string {
  const key = `verify.error_${code}`;
  const mapped = t(key);
  return mapped === key ? t("verify.error_generic") : mapped;
}

export default function VerifyWorkReportScreen() {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const params = useLocalSearchParams<{ slot_nid: string; work_report_nid?: string }>();
  const slotNidParam =
    typeof params.slot_nid === "string" ? params.slot_nid : "";
  const workReportNid =
    typeof params.work_report_nid === "string" ? params.work_report_nid : "";

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WorkReportDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn || !workReportNid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await fetchWorkReportDetail(workReportNid);
      setReport(detail);
    } catch {
      setLoadError(t("verify.error_load"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [signedIn, workReportNid]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (slotNidParam && isVerificationSlotCompleted(slotNidParam)) {
        router.replace("/(tabs)/earn");
      }
    }, [slotNidParam]),
  );

  const finishVerification = useCallback(() => {
    router.replace("/(tabs)/earn");
  }, []);

  const runVerdict = (verdict: VerificationVerdict) => {
    if (!report?.verification) return;

    const verification = report.verification;
    const slotNid = verification.slot_nid;

    const submit = async () => {
      setBusy(true);
      setActionError(null);
      try {
        const res: SubmitVerificationResponse = await submitVerification(
          slotNid,
          {
            verdict,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(report.hours != null && report.hours > 0
              ? { verified_hours: report.hours }
              : {}),
          },
        );
        if (!res.ok) {
          setActionError(verifyErrorCopy(res.error));
          return;
        }
        markVerificationCompleted(slotNid);
        void refreshPendingVerifications();
        Alert.alert(t("verify.success_title"), t("verify.success_body"), [
          { text: t("verify.done"), onPress: finishVerification },
        ]);
      } catch {
        setActionError(t("verify.error_generic"));
      } finally {
        setBusy(false);
      }
    };

    if (verdict === "reject" && !note.trim()) {
      Alert.alert(t("verify.reject_note_title"), t("verify.reject_note_body"));
      return;
    }

    const titleKey =
      verdict === "approve"
        ? "verify.confirm_approve_title"
        : verdict === "reject"
          ? "verify.confirm_reject_title"
          : "verify.confirm_decline_title";
    const bodyKey =
      verdict === "reject"
        ? "verify.confirm_reject_body"
        : verdict === "decline"
          ? "verify.confirm_decline_body"
          : null;

    if (verdict === "approve") {
      Alert.alert(t(titleKey), undefined, [
        { text: t("volunteer.cancel"), style: "cancel" },
        {
          text: t("verify.confirm"),
          onPress: () => void submit(),
        },
      ]);
      return;
    }

    Alert.alert(t(titleKey), bodyKey ? t(bodyKey) : undefined, [
      { text: t("volunteer.cancel"), style: "cancel" },
      { text: t("verify.confirm"), style: verdict === "reject" ? "destructive" : "default", onPress: () => void submit() },
    ]);
  };

  if (!signedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{t("volunteer.sign_in_hint")}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (loadError || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError ?? t("verify.error_load")}</Text>
        <Pressable onPress={() => router.back()} style={styles.ghost}>
          <Text style={styles.ghostText}>{t("verify.back")}</Text>
        </Pressable>
      </View>
    );
  }

  const verification = report.verification;
  const date = formatIsoDate(report.created_at);
  const photos = report.photo_urls ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{report.title}</Text>
        {report.project_name ? (
          <Text style={styles.meta}>
            {t("verify.project_label")} {report.project_name}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {date ? <Text style={styles.meta}>{date}</Text> : null}
          {report.author_username ? (
            <Text style={styles.meta}>@{report.author_username}</Text>
          ) : null}
        </View>

        {report.nace_label ? (
          <Text style={styles.nace}>
            {t("volunteer.nace")}: {report.nace_label}
          </Text>
        ) : null}

        <Text style={styles.label}>{t("verify.description_label")}</Text>
        {report.summary ? (
          <Text style={styles.summary}>{report.summary}</Text>
        ) : (
          <Text style={styles.hint}>{t("project.no_ledger_summary")}</Text>
        )}

        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
          >
            {photos.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => void Linking.openURL(uri)}
                accessibilityRole="imagebutton"
              >
                <Image source={{ uri }} style={styles.photo} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <WorkReportProofView report={report} />

        {verification ? (
          <View style={styles.actions}>
            <Text style={styles.label}>{t("verify.verified_hours")}</Text>
            <Text style={styles.duration}>
              {formatDurationHoursMinutes(report.hours ?? null)}
            </Text>
            <Text style={styles.label}>{t("verify.note_optional")}</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              multiline
              editable={!busy}
            />
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            <Pressable
              style={[styles.secondaryBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => runVerdict("approve")}
            >
              {busy ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.secondaryText}>{t("verify.approve")}</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => runVerdict("reject")}
            >
              <Text style={styles.secondaryText}>{t("verify.reject")}</Text>
            </Pressable>
            {verification.can_decline ? (
              <Pressable
                style={[styles.ghost, busy && styles.disabled]}
                disabled={busy}
                onPress={() => runVerdict("decline")}
              >
                <Text style={styles.ghostText}>{t("verify.decline")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.hint}>{t("verify.not_assigned_hint")}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  meta: { fontSize: 14, color: colors.muted },
  nace: { fontSize: 14, color: colors.ink },
  summary: { fontSize: 15, lineHeight: 22, color: colors.ink },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: { fontSize: 14, color: "#b42318", lineHeight: 20 },
  photoRow: { gap: 8 },
  photo: { width: 120, height: 120, borderRadius: 8 },
  actions: { gap: 10, marginTop: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  duration: { fontSize: 16, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontWeight: "600", fontSize: 16 },
  ghost: { paddingVertical: 10, alignItems: "center" },
  ghostText: { color: colors.brand, fontSize: 15 },
  disabled: { opacity: 0.6 },
});
