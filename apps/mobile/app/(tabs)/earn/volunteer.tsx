import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, router, useFocusEffect } from "expo-router";
import type {
  CreateWorkReportErrorCode,
  NaceNode,
  RewardKind,
  VolunteerProjectRow,
} from "@civic/shared";
import type { WorkReportGeoJsonGeometry } from "@civic/shared";
import { round2 } from "@civic/shared";
import { CreateProjectSection } from "@/components/CreateProjectSection";
import { NacePicker, findNaceNode } from "@/components/NacePicker";
import { VolunteerMapProofSection } from "@/components/VolunteerMapProofSection";
import { VolunteerPhotoList } from "@/components/VolunteerPhotoList";
import { colors } from "@/constants/theme";
import {
  createWorkReport,
  classifyNaceFromDescription,
  fetchMyProjects,
  fetchNaceTree,
  fetchWorkReportFeeInfo,
} from "@/lib/api";
import { capture } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { useChronPreference } from "@/lib/chron-preference";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import {
  pickVolunteerPhoto,
  rotateVolunteerPhoto,
  volunteerPhotoPickerAvailable,
  type VolunteerPhotoDraft,
} from "@/lib/pick-volunteer-photo";
import { useProjectSearch } from "@/lib/use-project-search";

const ROVAS_API_DOCS = "https://neofund.sk/rovas-api";
const FALLBACK_CIVIC_FEE_RATE = 0.03;
const FALLBACK_ROVAS_FEE_RATE = 0.01;

function formatFeePercent(rate: number, fallbackRate: number): string {
  const r = Number.isFinite(rate) && rate > 0 ? rate : fallbackRate;
  const pct = r * 100;
  const rounded = Math.round(pct * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatRewardAmount(n: number): string {
  const rounded = round2(n);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

function feeNoticeCopy(civicPct: string, rovasPct: string): string {
  return t("volunteer.fee_notice")
    .replace(/\{\{civic_percent\}\}/g, civicPct)
    .replace(/\{\{rovas_percent\}\}/g, rovasPct);
}

type RewardPreviewModel = {
  label: string;
  amount: string;
  showFeeMarker: boolean;
  feeLine: string | null;
};

function todaySk(): string {
  const n = new Date();
  const dd = String(n.getDate()).padStart(2, "0");
  const mm = String(n.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${n.getFullYear()}`;
}

function parseSkDate(value: string): number | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(y, mo, d, 12, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    return null;
  }
  return Math.floor(dt.getTime() / 1000);
}

function errorCopy(code: CreateWorkReportErrorCode | string): string {
  const key = `volunteer.error_${code}`;
  const mapped = t(key);
  return mapped === key ? t("volunteer.error_generic") : mapped;
}

/** Combine whole hours + minutes into a decimal hours value for the API. */
function parseDurationHours(
  hoursStr: string,
  minutesStr: string,
): number | null {
  const hRaw = hoursStr.trim() === "" ? 0 : Number(hoursStr.replace(",", "."));
  const mRaw =
    minutesStr.trim() === "" ? 0 : Number(minutesStr.replace(",", "."));
  if (!Number.isFinite(hRaw) || !Number.isFinite(mRaw)) return null;
  if (hRaw < 0 || mRaw < 0) return null;
  if (!Number.isInteger(hRaw) || !Number.isInteger(mRaw)) return null;
  if (mRaw > 59) return null;
  const total = hRaw + mRaw / 60;
  if (total <= 0) return null;
  return Math.round(total * 1000) / 1000;
}

export default function VolunteerScreen() {
  useLocale();
  const { status } = useAuth();
  const signedIn = status === "signedIn";

  const [mine, setMine] = useState<VolunteerProjectRow[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [selected, setSelected] = useState<VolunteerProjectRow | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const [date, setDate] = useState(todaySk);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [naceTree, setNaceTree] = useState<NaceNode[]>([]);
  const [nace, setNace] = useState<NaceNode | null>(null);
  const [naceAiSuggested, setNaceAiSuggested] = useState(false);
  const [naceClassifying, setNaceClassifying] = useState(false);
  /** Classify feedback shown next to the AI button (not only at form foot). */
  const [naceAiError, setNaceAiError] = useState<string | null>(null);
  const [naceTipsOpen, setNaceTipsOpen] = useState(false);
  const { allowChrons } = useChronPreference();
  const [webUrl, setWebUrl] = useState("");
  const [photos, setPhotos] = useState<VolunteerPhotoDraft[]>([]);
  const [mapLocation, setMapLocation] = useState<WorkReportGeoJsonGeometry | null>(
    null,
  );
  const [rotatingPhotoIndex, setRotatingPhotoIndex] = useState<number | null>(
    null,
  );
  const [reward, setReward] = useState<RewardKind>("merits");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [civicFeeRate, setCivicFeeRate] = useState(FALLBACK_CIVIC_FEE_RATE);
  const [rovasFeeRate, setRovasFeeRate] = useState(FALLBACK_ROVAS_FEE_RATE);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  const { results, searching, searchError, queryLongEnough } = useProjectSearch(
    searchQ,
    { enabled: signedIn && findOpen },
  );

  const loadMine = useCallback(() => {
    if (!signedIn) return;
    setMineLoading(true);
    void fetchMyProjects()
      .then((r) => setMine(r.projects))
      .catch(() => setMine([]))
      .finally(() => setMineLoading(false));
    void fetchNaceTree()
      .then((r) => setNaceTree(r.tree))
      .catch(() => setNaceTree([]));
  }, [signedIn]);

  const loadFeeInfo = useCallback(() => {
    void fetchWorkReportFeeInfo()
      .then((info) => {
        setFeeEnabled(info.enabled);
        setCivicFeeRate(
          Number.isFinite(info.wr_usage_fee_rate) && info.wr_usage_fee_rate > 0
            ? info.wr_usage_fee_rate
            : FALLBACK_CIVIC_FEE_RATE,
        );
        setRovasFeeRate(
          Number.isFinite(info.rovas_platform_fee_rate) &&
            info.rovas_platform_fee_rate > 0
            ? info.rovas_platform_fee_rate
            : FALLBACK_ROVAS_FEE_RATE,
        );
      })
      .catch(() => {
        setFeeEnabled(true);
        setCivicFeeRate(FALLBACK_CIVIC_FEE_RATE);
        setRovasFeeRate(FALLBACK_ROVAS_FEE_RATE);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMine();
      loadFeeInfo();
    }, [loadMine, loadFeeInfo]),
  );

  const resetForm = useCallback(() => {
    setDate(todaySk());
    setHours("");
    setMinutes("");
    setDescription("");
    setTitle("");
    setNace(null);
    setNaceAiSuggested(false);
    setNaceAiError(null);
    setWebUrl("");
    setPhotos([]);
    setMapLocation(null);
    setReward("merits");
    setFormError(null);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (!allowChrons && reward !== "merits") {
      setReward("merits");
    }
  }, [allowChrons, reward]);

  const canSubmit = Boolean(signedIn && selected);

  const durationHours = parseDurationHours(hours, minutes);
  const effectiveReward: RewardKind = allowChrons ? reward : "merits";
  const rewardPreview = ((): RewardPreviewModel | null => {
    if (durationHours == null || durationHours <= 0) return null;
    const gross = round2(durationHours * 10);
    const civicRate = feeEnabled ? civicFeeRate : 0;
    const totalFeeRate = civicRate + rovasFeeRate;
    const feeAmount = round2(gross * totalFeeRate);
    const net = round2(gross - feeAmount);
    const unit = effectiveReward === "chrons" ? "CHR" : "ME";
    const amountValue = `${formatRewardAmount(feeAmount > 0 ? net : gross)} ${unit}`;
    const feeLine =
      feeAmount > 0
        ? t("volunteer.reward_preview_fee_line").replace(
            /\{\{fee\}\}/g,
            formatRewardAmount(feeAmount),
          )
        : null;
    return {
      label: t("volunteer.reward_preview_label"),
      amount: amountValue,
      showFeeMarker: feeEnabled,
      feeLine,
    };
  })();
  const civicFeePct = formatFeePercent(civicFeeRate, FALLBACK_CIVIC_FEE_RATE);
  const rovasFeePct = formatFeePercent(rovasFeeRate, FALLBACK_ROVAS_FEE_RATE);

  const onPickPhoto = async () => {
    setFormError(null);
    const result = await pickVolunteerPhoto(photos.length);
    if (result.ok) {
      setPhotos((prev) => {
        if (prev.length >= 5) return prev;
        return [...prev, result.photo];
      });
      return;
    }
    if (result.reason === "unavailable") {
      setFormError(t("volunteer.error_photo_native"));
      return;
    }
    if (result.reason === "denied") {
      setFormError(t("volunteer.error_photo"));
      return;
    }
    if (result.reason === "error") {
      setFormError(result.message ?? t("volunteer.error_photo"));
      return;
    }
  };

  const onRotatePhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    setFormError(null);
    setRotatingPhotoIndex(index);
    try {
      const rotated = await rotateVolunteerPhoto(photo);
      setPhotos((prev) =>
        prev.map((item, idx) => (idx === index ? rotated : item)),
      );
    } catch {
      setFormError(t("volunteer.error_photo"));
    } finally {
      setRotatingPhotoIndex(null);
    }
  };

  const onClassifyNace = async () => {
    setFormError(null);
    setNaceAiError(null);
    const desc = description.trim();
    if (!desc) {
      setNaceAiError(t("volunteer.nace_ai_need_description"));
      return;
    }
    setNaceClassifying(true);
    try {
      const res = await classifyNaceFromDescription({
        description: desc,
        ...(selected?.project_nid ? { project_nid: selected.project_nid } : {}),
      });
      if (res.status === "ok" && res.nace_tid) {
        const fromTree = findNaceNode(naceTree, res.nace_tid);
        setNace(
          fromTree ?? {
            tid: res.nace_tid,
            code: res.nace_code,
            label: res.nace_label || res.nace_code || res.nace_tid,
            children: [],
          },
        );
        setNaceAiSuggested(true);
        if (res.title?.trim()) {
          setTitle(res.title.trim());
        }
        return;
      }
      setNaceAiSuggested(false);
      if (res.status === "need_more_info") {
        setNaceAiError(
          res.clarifying_question || t("volunteer.nace_ai_need_more"),
        );
        return;
      }
      if (res.status === "unavailable") {
        setNaceAiError(t("volunteer.nace_ai_unavailable"));
        return;
      }
      setNaceAiError(res.error || t("volunteer.nace_ai_error"));
    } catch {
      setNaceAiError(t("volunteer.nace_ai_error"));
    } finally {
      setNaceClassifying(false);
    }
  };

  const onSubmit = async () => {
    setFormError(null);
    if (!selected) {
      setFormError(t("volunteer.project_placeholder"));
      return;
    }
    if (!selected.can_report) {
      setFormError(t("volunteer.private_project"));
      return;
    }
    const started = parseSkDate(date);
    if (started == null) {
      setFormError(t("volunteer.error_date"));
      return;
    }
    const hrs = parseDurationHours(hours, minutes);
    if (hrs == null) {
      setFormError(t("volunteer.error_hours"));
      return;
    }
    const desc = description.trim();
    if (!desc) {
      setFormError(t("volunteer.error_invalid_input"));
      return;
    }
    if (!nace) {
      setFormError(t("volunteer.nace_placeholder"));
      return;
    }
    const url = webUrl.trim();
    if (!url && photos.length === 0 && !mapLocation) {
      setFormError(t("volunteer.proof_hint"));
      return;
    }
    setBusy(true);
    try {
      const res = await createWorkReport({
        project_nid: selected.project_nid,
        date_started: started,
        hours: hrs,
        description: desc,
        nace_tid: nace.tid,
        reward_kind: effectiveReward,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(url ? { web_url: url } : {}),
        ...(photos.length > 0 ? { photos } : {}),
        ...(mapLocation ? { field_location: mapLocation } : {}),
      });
      if (!res.ok) {
        setFormError(errorCopy(res.error));
        return;
      }
      capture("volunteer_report_submitted", { success: true });
      setSuccess(true);
    } catch {
      setFormError(t("volunteer.error_generic"));
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.success}>{t("volunteer.success")}</Text>
        <Pressable
          style={styles.ghost}
          onPress={() => {
            resetForm();
            router.replace("/(tabs)");
          }}
        >
          <Text style={styles.ghostText}>{t("Domov")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <Text style={styles.heading}>{t("volunteer.heading")}</Text>
        <Text style={styles.intro}>{t("volunteer.intro")}</Text>

        {!signedIn ? (
          <View style={styles.authBox}>
            <Text style={styles.hint}>{t("volunteer.sign_in_hint")}</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.btn}>
                <Text style={styles.btnText}>{t("home.sign_in")}</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}

        <Text style={styles.stepHeading}>{t("volunteer.step1_heading")}</Text>
        <View style={styles.pillbox}>
          {signedIn ? (
            <Text style={styles.hint}>{t("volunteer.project_recent_hint")}</Text>
          ) : null}
          {mineLoading ? <ActivityIndicator color={colors.brand} /> : null}
          {signedIn && !mineLoading && mine.length === 0 && !selected ? (
            <Text style={styles.hint}>{t("volunteer.project_empty")}</Text>
          ) : null}
          {mine.map((p) => (
            <Pressable
              key={p.project_nid}
              style={[
                styles.choice,
                selected?.project_nid === p.project_nid && styles.choiceOn,
              ]}
              onPress={() => setSelected(p)}
              disabled={!signedIn}
            >
              <Text style={styles.choiceText}>{p.title}</Text>
            </Pressable>
          ))}
          {selected &&
          !mine.some((p) => p.project_nid === selected.project_nid) ? (
            <View
              style={[
                styles.choice,
                styles.choiceOn,
                !selected.can_report && styles.choiceWarn,
              ]}
            >
              <Text style={styles.choiceText}>{selected.title}</Text>
              {!selected.can_report ? (
                <Text style={styles.warn}>{t("volunteer.private_project")}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.projectLinks}>
            <Pressable
              style={styles.projectLink}
              onPress={() => setFindOpen((v) => !v)}
              disabled={!signedIn}
            >
              <MaterialIcons
                name="search"
                size={18}
                color={colors.brand}
                style={styles.projectLinkIcon}
              />
              <Text style={styles.link}>{t("volunteer.find_another")}</Text>
            </Pressable>
            {findOpen && signedIn ? (
              <View style={styles.searchBox}>
                <TextInput
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder={t("volunteer.search_placeholder")}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  style={styles.input}
                />
                {searching ? <ActivityIndicator color={colors.brand} /> : null}
                {searchError ? (
                  <Text style={styles.error}>{t("volunteer.search_error")}</Text>
                ) : null}
                {queryLongEnough && !searching && !searchError ? (
                  results.length === 0 ? (
                    <Text style={styles.hint}>{t("volunteer.search_empty")}</Text>
                  ) : (
                    results.map((p) => (
                      <Pressable
                        key={p.project_nid}
                        style={styles.choice}
                        onPress={() => {
                          setSelected(p);
                          setFindOpen(false);
                          setSearchQ("");
                        }}
                      >
                        <Text style={styles.choiceText}>{p.title}</Text>
                        {!p.can_report ? (
                          <Text style={styles.warnMuted}>
                            {t("volunteer.private_project")}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))
                  )
                ) : null}
              </View>
            ) : null}

            <CreateProjectSection
              open={createOpen}
              onToggle={() => setCreateOpen((v) => !v)}
              disabled={!signedIn}
              onCreated={(p) => {
                const row: VolunteerProjectRow = {
                  project_nid: p.project_nid,
                  title: p.title,
                  is_public: true,
                  can_report: true,
                };
                setMine((prev) => [
                  row,
                  ...prev.filter((x) => x.project_nid !== row.project_nid),
                ]);
                setSelected(row);
                setCreateOpen(false);
              }}
            />
          </View>
        </View>

        <Text style={styles.stepHeading}>{t("volunteer.step2_heading")}</Text>
        <View style={styles.pillbox}>
        <Text style={[styles.label, styles.labelFirst]}>{t("volunteer.date")}</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder={t("volunteer.date_placeholder")}
          placeholderTextColor={colors.muted}
          style={styles.input}
          editable={signedIn}
        />

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.label}>{t("volunteer.hours")}</Text>
            <TextInput
              value={hours}
              onChangeText={setHours}
              placeholder={t("volunteer.hours_placeholder")}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.input}
              editable={signedIn}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>{t("volunteer.minutes")}</Text>
            <TextInput
              value={minutes}
              onChangeText={setMinutes}
              placeholder={t("volunteer.minutes_placeholder")}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.input}
              editable={signedIn}
            />
          </View>
        </View>

        <Text style={styles.label}>{t("volunteer.description")}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t("volunteer.description_placeholder")}
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.area]}
          multiline
          textAlignVertical="top"
          editable={signedIn}
        />

        <Text style={styles.label}>{t("volunteer.title_field")}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t("volunteer.title_placeholder")}
          placeholderTextColor={colors.muted}
          style={styles.input}
          editable={signedIn}
        />

        <View style={styles.naceAiRow}>
          <Pressable
            style={styles.naceAiHelp}
            onPress={() => setNaceTipsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("volunteer.nace_ai_help")}
          >
            <Text style={styles.naceAiHelpText}>?</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondary,
              styles.naceAiButton,
              (!signedIn || naceClassifying) && styles.btnDisabled,
            ]}
            onPress={() => void onClassifyNace()}
            disabled={!signedIn || naceClassifying}
          >
            {naceClassifying ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.secondaryText}>
                {t("volunteer.nace_ai_button")}
              </Text>
            )}
          </Pressable>
        </View>
        {naceAiError ? <Text style={styles.error}>{naceAiError}</Text> : null}

        <Text style={styles.label}>{t("volunteer.nace")}</Text>
        {signedIn && naceTree.length === 0 && !mineLoading ? (
          <Text style={styles.hint}>{t("volunteer.nace_error")}</Text>
        ) : null}
        {naceTree.length > 0 ? (
          <NacePicker
            tree={naceTree}
            selectedTid={nace?.tid ?? null}
            aiSuggested={naceAiSuggested}
            onSelect={(node) => {
              setNace(node);
              setNaceAiSuggested(false);
            }}
            scrollRef={scrollRef}
            getScrollY={() => scrollYRef.current}
          />
        ) : null}

        <Text style={styles.label}>{t("volunteer.proof")}</Text>
        <Text style={styles.hint}>{t("volunteer.proof_hint")}</Text>
        <Text style={styles.label}>{t("volunteer.proof_url")}</Text>
        <TextInput
          value={webUrl}
          onChangeText={setWebUrl}
          placeholder={t("volunteer.proof_url_placeholder")}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
          editable={signedIn}
        />
        <Text style={styles.label}>{t("volunteer.proof_photos")}</Text>
        {__DEV__ && !volunteerPhotoPickerAvailable() ? (
          <Text style={styles.warn}>
            {t("volunteer.error_photo_native")}
          </Text>
        ) : null}
        {photos.length > 0 ? (
          <VolunteerPhotoList
            photos={photos}
            rotatingIndex={rotatingPhotoIndex}
            disabled={!signedIn}
            onRotate={(index) => void onRotatePhoto(index)}
            onRemove={(index) =>
              setPhotos((prev) => prev.filter((_, idx) => idx !== index))
            }
          />
        ) : null}
        {photos.length < 5 ? (
          <Pressable
            style={styles.secondary}
            onPress={() => void onPickPhoto()}
            disabled={!signedIn}
          >
            <Text style={styles.secondaryText}>{t("volunteer.add_photo")}</Text>
          </Pressable>
        ) : null}

        <VolunteerMapProofSection
          open={mapOpen}
          onToggle={() => setMapOpen((v) => !v)}
          disabled={!signedIn}
          geometry={mapLocation}
          onChange={setMapLocation}
        />

        {allowChrons ? (
          <View style={styles.checkboxRow}>
            <Switch
              value={reward === "chrons"}
              onValueChange={(checked) =>
                setReward(checked ? "chrons" : "merits")
              }
              disabled={!signedIn}
              trackColor={{ false: colors.border, true: colors.brandSoft }}
            />
            <Text style={styles.checkboxLabel}>
              {t("volunteer.reward_chrons_instead")}
            </Text>
          </View>
        ) : null}

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        {rewardPreview ? (
          <View style={styles.rewardPreviewBox}>
            <Text style={styles.rewardPreviewLabel}>{rewardPreview.label}</Text>
            <Text style={styles.rewardPreviewAmount}>
              {rewardPreview.amount}
              {rewardPreview.showFeeMarker ? (
                <Text style={styles.rewardPreviewMarker}>**</Text>
              ) : null}
            </Text>
            {rewardPreview.feeLine ? (
              <Text style={styles.rewardPreviewFee}>{rewardPreview.feeLine}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.ghost}
            onPress={() => router.push("/(tabs)/earn")}
          >
            <Text style={styles.ghostText}>{t("volunteer.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.btn,
              (!signedIn || busy || !canSubmit) && styles.btnDisabled,
            ]}
            disabled={!signedIn || busy || !canSubmit}
            onPress={() => void onSubmit()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {busy ? t("volunteer.submitting") : t("volunteer.submit")}
              </Text>
            )}
          </Pressable>
        </View>
        </View>

        {feeEnabled ? (
          <Text style={styles.footerMuted}>
            {feeNoticeCopy(civicFeePct, rovasFeePct)}
          </Text>
        ) : null}
        <Text style={styles.footerApiHint}>
          {t("volunteer.api_hint_before")}
          <Text
            style={styles.link}
            onPress={() => void Linking.openURL(ROVAS_API_DOCS)}
          >
            {t("volunteer.api_hint_link")}
          </Text>
          {t("volunteer.api_hint_after")}
        </Text>
      </ScrollView>

      <Modal
        visible={naceTipsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNaceTipsOpen(false)}
      >
        <Pressable
          style={styles.tipsBackdrop}
          onPress={() => setNaceTipsOpen(false)}
        >
          <Pressable
            style={styles.tipsCard}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            <Text style={styles.tipsTitle}>
              {t("volunteer.nace_ai_tips_title")}
            </Text>
            <ScrollView
              style={styles.tipsScroll}
              contentContainerStyle={styles.tipsScrollContent}
            >
              {(
                [
                  "volunteer.nace_ai_tip_1",
                  "volunteer.nace_ai_tip_2",
                  "volunteer.nace_ai_tip_3",
                  "volunteer.nace_ai_tip_4",
                  "volunteer.nace_ai_tip_5",
                ] as const
              ).map((key) => (
                <View key={key} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{t(key)}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.tipsClose}
              onPress={() => setNaceTipsOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.tipsCloseText}>{t("common.close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: "700", color: colors.ink },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  rewardPreviewBox: {
    marginTop: 16,
    marginBottom: 4,
    alignItems: "center",
    gap: 2,
  },
  rewardPreviewLabel: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  rewardPreviewAmount: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  rewardPreviewMarker: {
    fontSize: 14,
    lineHeight: 26,
    fontWeight: "400",
    color: colors.ink,
  },
  rewardPreviewFee: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  feeNotice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  authBox: {
    backgroundColor: "#E8EFEA",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  stepHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 4,
  },
  pillbox: {
    backgroundColor: "#E8EFEA",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  labelFirst: { marginTop: 0 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: {
    fontWeight: "600",
    color: colors.ink,
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  area: { minHeight: 90 },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  choiceOn: { borderColor: colors.brand, backgroundColor: "#E8EFEA" },
  choiceWarn: { borderColor: colors.danger },
  choiceText: { color: colors.ink, fontWeight: "600" },
  warn: { color: colors.danger, fontSize: 12 },
  warnMuted: { color: colors.muted, fontSize: 12 },
  link: { color: colors.brand, fontWeight: "700" },
  projectLinks: { gap: 4, marginVertical: 4 },
  projectLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  projectLinkIcon: { marginRight: 4 },
  searchBox: { gap: 8, marginBottom: 4 },
  row2: { flexDirection: "row", gap: 12 },
  col: { flex: 1, gap: 6 },
  secondary: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: colors.brand, fontWeight: "700", textAlign: "center" },
  naceAiRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  naceAiHelp: {
    width: 44,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  naceAiHelpText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 18,
  },
  naceAiButton: {
    flex: 1,
    paddingHorizontal: 10,
  },
  tipsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    gap: 14,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  tipsScroll: { flexGrow: 0 },
  tipsScrollContent: { gap: 12, paddingBottom: 4 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipBullet: { color: colors.brand, fontSize: 15, lineHeight: 22, fontWeight: "700" },
  tipText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  tipsClose: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  tipsCloseText: { color: colors.brand, fontWeight: "700" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  checkboxLabel: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  btn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: { paddingVertical: 14, paddingHorizontal: 12 },
  ghostText: { color: colors.muted, fontWeight: "700" },
  footerApiHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 28,
  },
  footerMuted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
  },
  success: { fontSize: 16, color: colors.ink, lineHeight: 22 },
});
