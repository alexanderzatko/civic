import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Link } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
  type ClaimReceiptErrorCode,
  type ClaimReceiptResponse,
  type ReceiptHistoryFilters,
  type ReceiptHistoryRetention,
  type ReceiptHistoryView,
  type ReceiptReceivedItem,
  type ReceiptSubmittedItem,
  type VerifiedReceiptPreview,
  type VerifyReceiptResponse,
} from "@civic/shared";
import { AddRecipientModal } from "@/components/AddRecipientModal";
import { ReceiptDetailModal } from "@/components/ReceiptDetailModal";
import { ReceiptHistoryRetentionModal } from "@/components/ReceiptHistoryRetentionModal";
import { ShareEditor } from "@/components/ShareEditor";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { capture } from "@/lib/analytics";
import { claimReceipt, fetchMe, fetchReceiptHistory, verifyReceipt } from "@/lib/api";
import { notifyMeritsChanged } from "@/lib/merits-refresh";
import { useReceiptHistoryPreference } from "@/lib/receipt-history-preference";
import { useMeritsAutoRefresh } from "@/lib/useMeritsAutoRefresh";
import {
  loadRecipientMemory,
  rememberRecipient,
  setAlwaysShare,
  touchRecipients,
} from "@/lib/recipient-memory";
import {
  shareSum,
  withEqualShares,
  type SplitRecipient,
} from "@/lib/split-shares";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

type ScanBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type MeProfile = {
  rovas_uid: string;
  username: string;
  display_name: string;
};

type HistoryFilterDraft = {
  merchant: string;
  dateFrom: string;
  dateTo: string;
  minVat: string;
  maxVat: string;
};

const EMPTY_HISTORY_FILTERS: HistoryFilterDraft = {
  merchant: "",
  dateFrom: "",
  dateTo: "",
  minVat: "",
  maxVat: "",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function historyFiltersActive(f: HistoryFilterDraft): boolean {
  return Boolean(
    f.merchant.trim() ||
      f.dateFrom.trim() ||
      f.dateTo.trim() ||
      f.minVat.trim() ||
      f.maxVat.trim(),
  );
}

function toApiFilters(
  f: HistoryFilterDraft,
  view: ReceiptHistoryView,
): ReceiptHistoryFilters {
  const out: ReceiptHistoryFilters = {};
  const merchant = f.merchant.trim();
  if (merchant) out.merchant = merchant;
  const dateFrom = f.dateFrom.trim();
  const dateTo = f.dateTo.trim();
  if (ISO_DATE_RE.test(dateFrom)) out.date_from = dateFrom;
  if (ISO_DATE_RE.test(dateTo)) out.date_to = dateTo;
  if (view === "submitted") {
    const minRaw = f.minVat.trim().replace(",", ".");
    const maxRaw = f.maxVat.trim().replace(",", ".");
    if (minRaw !== "") {
      const n = Number(minRaw);
      if (Number.isFinite(n)) out.min_vat_eur = n;
    }
    if (maxRaw !== "") {
      const n = Number(maxRaw);
      if (Number.isFinite(n)) out.max_vat_eur = n;
    }
  }
  return out;
}

export default function ReceiptsScreen() {
  useLocale();
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "signedIn";
  const {
    retention,
    ready: retentionReady,
    setRetention,
  } = useReceiptHistoryPreference();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [uidInput, setUidInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [preview, setPreview] = useState<VerifiedReceiptPreview | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimReceiptResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [scannedLock, setScannedLock] = useState(false);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [scanBounds, setScanBounds] = useState<ScanBounds | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [recipients, setRecipients] = useState<SplitRecipient[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [historyTab, setHistoryTab] =
    useState<ReceiptHistoryView>("submitted");
  const [submittedItems, setSubmittedItems] = useState<ReceiptSubmittedItem[]>(
    [],
  );
  const [receivedItems, setReceivedItems] = useState<ReceiptReceivedItem[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [retentionModalOpen, setRetentionModalOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<HistoryFilterDraft>(
    EMPTY_HISTORY_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<HistoryFilterDraft>(
    EMPTY_HISTORY_FILTERS,
  );
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtersActive = historyFiltersActive(appliedFilters);

  const seedRecipients = useCallback(async (profile: MeProfile) => {
    const memory = await loadRecipientMemory();
    const always = memory.filter(
      (m) => m.alwaysShare && m.rovas_uid !== profile.rovas_uid,
    );
    const base: Omit<SplitRecipient, "sharePct">[] = [
      {
        rovas_uid: profile.rovas_uid,
        username: profile.username,
        display_name: profile.display_name,
        isScanner: true,
        alwaysShare: false,
      },
      ...always.map((m) => ({
        rovas_uid: m.rovas_uid,
        username: m.username,
        display_name: m.display_name,
        isScanner: false,
        alwaysShare: true,
      })),
    ];
    setRecipients(withEqualShares(base));
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setMe(null);
      setSubmittedItems([]);
      setReceivedItems([]);
      setHistoryError(false);
      setFilterDraft(EMPTY_HISTORY_FILTERS);
      setAppliedFilters(EMPTY_HISTORY_FILTERS);
      return;
    }
    let cancelled = false;
    void fetchMe()
      .then((profile) => {
        if (cancelled) return;
        setMe({
          rovas_uid: profile.rovas_uid,
          username: profile.username ?? profile.rovas_uid,
          display_name:
            profile.display_name ?? profile.username ?? profile.rovas_uid,
        });
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const refreshHistory = useCallback(() => {
    if (!signedIn) return;
    setHistoryLoading(true);
    setHistoryError(false);
    const shared = toApiFilters(appliedFilters, "received");
    const submittedOpts = toApiFilters(appliedFilters, "submitted");
    void Promise.all([
      fetchReceiptHistory("submitted", submittedOpts),
      fetchReceiptHistory("received", shared),
    ])
      .then(([submitted, received]) => {
        setSubmittedItems(submitted.items);
        setReceivedItems(received.items);
      })
      .catch(() => {
        setHistoryError(true);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [signedIn, appliedFilters]);

  useMeritsAutoRefresh(refreshHistory);

  useEffect(() => {
    if (signedIn) refreshHistory();
  }, [signedIn, refreshHistory]);

  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setAppliedFilters(filterDraft);
    }, 300);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [filterDraft]);

  const clearHistoryFilters = useCallback(() => {
    setFilterDraft(EMPTY_HISTORY_FILTERS);
    setAppliedFilters(EMPTY_HISTORY_FILTERS);
  }, []);

  // If verify finished before /me resolved, seed split once profile arrives.
  useEffect(() => {
    if (
      !preview ||
      !me ||
      preview.already_claimed ||
      preview.claim_allowed === false ||
      claimResult?.claimed ||
      recipients.length > 0
    ) {
      return;
    }
    void seedRecipients(me);
  }, [preview, me, claimResult, recipients.length, seedRecipients]);

  const runVerify = useCallback(
    async (qrOrUid: string) => {
      setBusy(true);
      setError(null);
      setPreview(null);
      setClaimResult(null);
      setRecipients([]);
      try {
        const result: VerifyReceiptResponse = await verifyReceipt(qrOrUid);
        if (result.verified) {
          setPreview(result);
          setUidInput(result.receipt_uid);
          setScanning(false);
          setScanBounds(null);
          setManualOpen(false);
          if (result.already_claimed) {
            setError(t("receipts.error_duplicate"));
            setRecipients([]);
          } else if (result.claim_allowed === false && result.claim_block) {
            setError(claimErrorMessage(result.claim_block.code, t));
            setRecipients([]);
          } else if (me) {
            await seedRecipients(me);
          } else if (signedIn) {
            try {
              const profile = await fetchMe();
              const next = {
                rovas_uid: profile.rovas_uid,
                username: profile.username ?? profile.rovas_uid,
                display_name:
                  profile.display_name ??
                  profile.username ??
                  profile.rovas_uid,
              };
              setMe(next);
              await seedRecipients(next);
            } catch {
              // Claim UI still works solo once me loads; share editor needs me.
            }
          }
        } else {
          const map: Record<string, string> = {
            invalid_uid: t("receipts.error_invalid"),
            not_found: t("receipts.error_not_found"),
            fs_error: t("receipts.error_fs"),
            offline_unsupported: t("receipts.error_fs"),
          };
          setError(map[result.code] ?? result.message);
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
    },
    [me, seedRecipients, signedIn],
  );

  async function startScan() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setError(null);
    setClaimResult(null);
    setScannedLock(false);
    setScanBounds(null);
    setManualOpen(false);
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

  const excludeUids = useMemo(
    () => new Set(recipients.map((r) => r.rovas_uid)),
    [recipients],
  );

  const sharesValid =
    recipients.length > 0 && Math.abs(shareSum(recipients) - 100) < 0.01;

  async function executeClaim() {
    if (!preview || !sharesValid || preview.claim_allowed === false) return;
    setClaiming(true);
    setError(null);
    setClaimResult(null);
    try {
      const shares = recipients.map((r) => ({
        rovas_uid: r.rovas_uid,
        share_pct: r.sharePct,
      }));
      const result = await claimReceipt(preview.receipt_uid, shares);
      setClaimResult(result);
      if (result.claimed) {
        capture("receipt_claimed", { success: true });
        notifyMeritsChanged();
        const nonScanner = recipients.filter((r) => !r.isScanner);
        if (nonScanner.length > 0) {
          await touchRecipients(
            nonScanner.map((r) => ({
              rovas_uid: r.rovas_uid,
              username: r.username,
              display_name: r.display_name,
              alwaysShare: r.alwaysShare,
            })),
          );
        }
      } else {
        if (result.code === "duplicate") {
          setPreview((prev) =>
            prev ? { ...prev, already_claimed: true, claim_allowed: false } : prev,
          );
          setRecipients([]);
          setAddOpen(false);
        }
        setError(claimErrorMessage(result.code, t, result.message));
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        setError(t("receipts.error_unauthorized"));
      } else {
        setError(t("receipts.error_api"));
      }
    } finally {
      setClaiming(false);
    }
  }

  async function runClaim() {
    if (!preview || !sharesValid || preview.claim_allowed === false) return;
    if (!retentionReady) return;
    if (retention == null) {
      setRetentionModalOpen(true);
      return;
    }
    await executeClaim();
  }

  async function onRetentionChosen(value: ReceiptHistoryRetention) {
    await setRetention(value);
    setRetentionModalOpen(false);
    await executeClaim();
  }

  function onChangeShare(rovasUid: string, sharePct: number) {
    setRecipients((prev) =>
      prev.map((r) => (r.rovas_uid === rovasUid ? { ...r, sharePct } : r)),
    );
  }

  async function onToggleAlways(rovasUid: string, alwaysShare: boolean) {
    setRecipients((prev) =>
      prev.map((r) => (r.rovas_uid === rovasUid ? { ...r, alwaysShare } : r)),
    );
    const row = recipients.find((r) => r.rovas_uid === rovasUid);
    if (row && !row.isScanner) {
      await rememberRecipient({
        rovas_uid: row.rovas_uid,
        username: row.username,
        display_name: row.display_name,
        alwaysShare,
      });
      await setAlwaysShare(rovasUid, alwaysShare);
    }
  }

  function onRemove(rovasUid: string) {
    setRecipients((prev) => {
      const next = prev.filter((r) => r.rovas_uid !== rovasUid);
      return withEqualShares(
        next.map(({ sharePct: _s, ...rest }) => rest),
      );
    });
  }

  function onPickRecipient(user: {
    rovas_uid: string;
    username: string;
    display_name: string;
    alwaysShare: boolean;
  }) {
    setRecipients((prev) => {
      if (prev.some((r) => r.rovas_uid === user.rovas_uid)) return prev;
      const base = [
        ...prev.map(({ sharePct: _s, ...rest }) => rest),
        {
          rovas_uid: user.rovas_uid,
          username: user.username,
          display_name: user.display_name,
          isScanner: false,
          alwaysShare: user.alwaysShare,
        },
      ];
      return withEqualShares(base);
    });
    void rememberRecipient({
      rovas_uid: user.rovas_uid,
      username: user.username,
      display_name: user.display_name,
      alwaysShare: user.alwaysShare,
    });
    setAddOpen(false);
  }

  const showScanner = scanning && permission?.granted;
  const claimSucceeded = claimResult?.claimed === true;
  const alreadyClaimed = preview?.already_claimed === true;
  const claimBlocked = preview?.claim_allowed === false;
  const canShowSplit =
    signedIn &&
    me &&
    recipients.length > 0 &&
    !claimSucceeded &&
    !alreadyClaimed &&
    !claimBlocked;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>{t("receipts.intro")}</Text>

      <Pressable
        style={styles.primary}
        onPress={startScan}
        disabled={busy || claiming}
      >
        <Text style={styles.primaryText}>{t("receipts.scan")}</Text>
      </Pressable>

      {showScanner ? (
        <View style={styles.cameraWrap} onLayout={onCameraLayout}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
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

      <Pressable
        style={styles.disclosure}
        onPress={() => setManualOpen((o) => !o)}
        accessibilityRole="button"
      >
        <Text style={styles.disclosureText}>
          {manualOpen
            ? t("receipts.manual_collapse")
            : t("receipts.manual_expand")}
        </Text>
      </Pressable>

      {manualOpen ? (
        <View style={styles.manualBox}>
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
            style={[styles.primary, (busy || claiming) && styles.disabled]}
            disabled={busy || claiming || !uidInput.trim()}
            onPress={() => void runVerify(uidInput)}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{t("receipts.verify")}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{t("receipts.preview_title")}</Text>
          <Row
            label={t("receipts.merchant")}
            value={preview.merchant_name ?? "—"}
          />
          <Row
            label={t("receipts.vat")}
            value={`${preview.vat_eur.toFixed(2)} ${t("common.eur")}`}
          />
          <Row
            label={t("receipts.merits")}
            value={`${preview.merits_preview.toFixed(2)} ${t("common.me")}`}
          />

          {claimSucceeded ? (
            <Text style={styles.success}>
              {t("receipts.claim_success")}{" "}
              ({claimResult.total_merits.toFixed(2)} {t("common.me")})
            </Text>
          ) : alreadyClaimed ? (
            <Text style={styles.error}>{t("receipts.error_duplicate")}</Text>
          ) : claimBlocked ? (
            <Text style={styles.error}>
              {preview.claim_block
                ? claimErrorMessage(preview.claim_block.code, t)
                : t("receipts.error_claim_blocked")}
            </Text>
          ) : signedIn ? (
            <>
              {canShowSplit ? (
                <ShareEditor
                  recipients={recipients}
                  totalMerits={preview.merits_preview}
                  onChangeShare={onChangeShare}
                  onToggleAlways={(uid, v) => void onToggleAlways(uid, v)}
                  onRemove={onRemove}
                  onAddPerson={() => setAddOpen(true)}
                />
              ) : null}
              <Pressable
                style={[
                  styles.primary,
                  (claiming || !sharesValid || !me) && styles.disabled,
                ]}
                disabled={claiming || !sharesValid || !me}
                onPress={() => void runClaim()}
              >
                {claiming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>{t("receipts.claim")}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.signInPrompt}>
              <Text style={styles.hint}>{t("receipts.claim_sign_in")}</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.secondary}>
                  <Text style={styles.secondaryText}>{t("home.sign_in")}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>
      ) : null}

      <ReceiptHistorySection
        signedIn={signedIn}
        myUid={me?.rovas_uid ?? null}
        tab={historyTab}
        onTabChange={setHistoryTab}
        submitted={submittedItems}
        received={receivedItems}
        loading={historyLoading}
        error={historyError}
        filters={filterDraft}
        filtersActive={filtersActive}
        onFiltersChange={setFilterDraft}
        onClearFilters={clearHistoryFilters}
        onOpenDetail={setDetailUid}
      />

      <ReceiptDetailModal
        receiptUid={detailUid}
        onClose={() => setDetailUid(null)}
      />

      <AddRecipientModal
        visible={addOpen}
        excludeUids={excludeUids}
        onClose={() => setAddOpen(false)}
        onPick={onPickRecipient}
      />

      <ReceiptHistoryRetentionModal
        visible={retentionModalOpen}
        onCancel={() => setRetentionModalOpen(false)}
        onChoose={onRetentionChosen}
      />
    </ScrollView>
  );
}

function ReceiptHistorySection({
  signedIn,
  myUid,
  tab,
  onTabChange,
  submitted,
  received,
  loading,
  error,
  filters,
  filtersActive,
  onFiltersChange,
  onClearFilters,
  onOpenDetail,
}: {
  signedIn: boolean;
  myUid: string | null;
  tab: ReceiptHistoryView;
  onTabChange: (tab: ReceiptHistoryView) => void;
  submitted: ReceiptSubmittedItem[];
  received: ReceiptReceivedItem[];
  loading: boolean;
  error: boolean;
  filters: HistoryFilterDraft;
  filtersActive: boolean;
  onFiltersChange: (next: HistoryFilterDraft) => void;
  onClearFilters: () => void;
  onOpenDetail: (receiptUid: string) => void;
}) {
  if (!signedIn) {
    return (
      <View style={styles.history}>
        <Text style={styles.empty}>{t("receipts.history_empty_signed_out")}</Text>
      </View>
    );
  }

  const isSubmitted = tab === "submitted";
  const items = isSubmitted ? submitted : received;
  const patchFilters = (partial: Partial<HistoryFilterDraft>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <View style={styles.history}>
      <View style={styles.historyTabs}>
        <Pressable
          style={[styles.historyTab, !isSubmitted && styles.historyTabActive]}
          onPress={() => onTabChange("received")}
        >
          <Text
            style={[
              styles.historyTabText,
              !isSubmitted && styles.historyTabTextActive,
            ]}
          >
            {t("receipts.history_tab_received")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.historyTab, isSubmitted && styles.historyTabActive]}
          onPress={() => onTabChange("submitted")}
        >
          <Text
            style={[
              styles.historyTabText,
              isSubmitted && styles.historyTabTextActive,
            ]}
          >
            {t("receipts.history_tab_submitted")}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.historyTitle}>
        {isSubmitted
          ? t("receipts.history_submitted_title")
          : t("receipts.history_received_title")}
      </Text>
      <Text style={styles.historyHint}>
        {isSubmitted
          ? t("receipts.history_submitted_hint")
          : t("receipts.history_received_hint")}
      </Text>

      <View style={styles.filterStrip}>
        <Text style={styles.filterLabel}>
          {t("receipts.history_filter_merchant")}
        </Text>
        <TextInput
          style={styles.input}
          value={filters.merchant}
          onChangeText={(merchant) => patchFilters({ merchant })}
          placeholder={t("receipts.history_filter_merchant_placeholder")}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <View style={styles.filterRow}>
          <View style={styles.filterHalf}>
            <Text style={styles.filterLabel}>
              {t("receipts.history_filter_date_from")}
            </Text>
            <TextInput
              style={styles.input}
              value={filters.dateFrom}
              onChangeText={(dateFrom) => patchFilters({ dateFrom })}
              placeholder={t("receipts.history_filter_date_placeholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.filterHalf}>
            <Text style={styles.filterLabel}>
              {t("receipts.history_filter_date_to")}
            </Text>
            <TextInput
              style={styles.input}
              value={filters.dateTo}
              onChangeText={(dateTo) => patchFilters({ dateTo })}
              placeholder={t("receipts.history_filter_date_placeholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        {isSubmitted ? (
          <View style={styles.filterRow}>
            <View style={styles.filterHalf}>
              <Text style={styles.filterLabel}>
                {t("receipts.history_filter_vat_min")}
              </Text>
              <TextInput
                style={styles.input}
                value={filters.minVat}
                onChangeText={(minVat) => patchFilters({ minVat })}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.filterHalf}>
              <Text style={styles.filterLabel}>
                {t("receipts.history_filter_vat_max")}
              </Text>
              <TextInput
                style={styles.input}
                value={filters.maxVat}
                onChangeText={(maxVat) => patchFilters({ maxVat })}
                placeholder="100"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ) : null}
        {filtersActive ? (
          <Pressable style={styles.filterClear} onPress={onClearFilters}>
            <Text style={styles.filterClearText}>
              {t("receipts.history_filter_clear")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      ) : error && items.length === 0 ? (
        <Text style={styles.empty}>{t("receipts.history_error")}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>
          {filtersActive
            ? t("receipts.history_empty_filtered")
            : t("receipts.history_empty")}
        </Text>
      ) : isSubmitted ? (
        <View style={styles.historyTable}>
          <View style={styles.historyHeaderRow}>
            <Text style={[styles.historyColDate, styles.historyHeader]}>
              {t("receipts.history_col_date")}
            </Text>
            <Text style={[styles.historyColMerchant, styles.historyHeader]}>
              {t("receipts.history_col_merchant")}
            </Text>
            <Text style={[styles.historyColNum, styles.historyHeader]}>
              {t("receipts.history_col_vat")}
            </Text>
            <Text style={[styles.historyColNum, styles.historyHeader]}>
              {t("receipts.history_col_me")}
            </Text>
          </View>
          {(submitted).map((row) => (
            <Pressable
              key={row.receipt_uid}
              style={styles.historyDataRow}
              onPress={() => onOpenDetail(row.receipt_uid)}
            >
              <Text style={styles.historyColDate}>
                {formatHistoryDate(row.purchase_at ?? row.created_at)}
              </Text>
              <Text style={styles.historyColMerchant} numberOfLines={2}>
                {row.merchant_name ?? "—"}
              </Text>
              <Text style={styles.historyColNum}>
                {row.vat_eur.toFixed(2)}
              </Text>
              <Text style={styles.historyColNum}>
                {row.total_merits_awarded.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.historyTable}>
          <View style={styles.historyHeaderRow}>
            <Text style={[styles.historyColDate, styles.historyHeader]}>
              {t("receipts.history_col_date")}
            </Text>
            <Text style={[styles.historyColMerchant, styles.historyHeader]}>
              {t("receipts.history_col_merchant")}
            </Text>
            <Text style={[styles.historyColFrom, styles.historyHeader]}>
              {t("receipts.history_col_from")}
            </Text>
            <Text style={[styles.historyColNum, styles.historyHeader]}>
              {t("receipts.history_col_share")}
            </Text>
            <Text style={[styles.historyColNum, styles.historyHeader]}>
              {t("receipts.history_col_me")}
            </Text>
          </View>
          {(received).map((row) => (
            <Pressable
              key={`${row.receipt_uid}:${row.scanner_rovas_uid}:${row.share_pct}`}
              style={styles.historyDataRow}
              onPress={() => onOpenDetail(row.receipt_uid)}
            >
              <Text style={styles.historyColDate}>
                {formatHistoryDate(row.purchase_at ?? row.created_at)}
              </Text>
              <Text style={styles.historyColMerchant} numberOfLines={2}>
                {row.merchant_name ?? "—"}
              </Text>
              <Text style={styles.historyColFrom} numberOfLines={1}>
                {formatScannerLabel(row, myUid)}
              </Text>
              <Text style={styles.historyColNum}>
                {Math.round(row.share_pct)} %
              </Text>
              <Text style={styles.historyColNum}>
                {row.merits_awarded.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function formatHistoryDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("sk-SK");
}

function claimErrorMessage(
  code: ClaimReceiptErrorCode | string,
  translate: (key: string) => string,
  fallback?: string,
): string {
  const map: Record<string, string> = {
    unauthorized: translate("receipts.error_unauthorized"),
    invalid_uid: translate("receipts.error_invalid"),
    not_found: translate("receipts.error_not_found"),
    fs_error: translate("receipts.error_fs"),
    duplicate: translate("receipts.error_duplicate"),
    rejected_location: translate("receipts.error_claim_blocked"),
    rejected_window: translate("receipts.error_window"),
    rejected_rate: translate("receipts.error_rate"),
    rejected_vat: translate("receipts.error_vat"),
    rejected_shares: translate("receipts.error_rovas"),
    rejected_strikes: translate("receipts.error_strikes"),
    rejected_account_age: translate("receipts.error_account_age"),
    rejected_same_store: translate("receipts.error_same_store"),
    rovas_error: translate("receipts.error_rovas"),
    offline_unsupported: translate("receipts.error_fs"),
  };
  return map[code] ?? fallback ?? translate("receipts.error_claim_blocked");
}

function formatScannerLabel(
  row: ReceiptReceivedItem,
  myUid: string | null,
): string {
  if (myUid && row.scanner_rovas_uid === myUid) {
    return t("receipts.history_you");
  }
  if (row.scanner_username) {
    return `@${row.scanner_username}`;
  }
  return `#${row.scanner_rovas_uid}`;
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
  disclosure: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  disclosureText: {
    color: colors.brandSoft,
    fontWeight: "700",
    fontSize: 14,
  },
  manualBox: { gap: 10 },
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
  rowValue: {
    color: colors.ink,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  hint: { fontSize: 12, color: colors.muted },
  success: { marginTop: 4, color: colors.ok, fontWeight: "700" },
  signInPrompt: { gap: 8, marginTop: 4 },
  secondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  secondaryText: { color: colors.brandSoft, fontWeight: "700", fontSize: 15 },
  empty: { color: colors.muted, marginTop: 12 },
  history: {
    marginTop: 20,
    gap: 8,
  },
  historyTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  historyTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyTabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  historyTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  historyTabTextActive: {
    color: "#fff",
  },
  historyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  historyHint: {
    fontSize: 12,
    color: colors.muted,
  },
  filterStrip: {
    marginTop: 4,
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterHalf: {
    flex: 1,
    gap: 4,
  },
  filterClear: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  filterClearText: {
    color: colors.brandSoft,
    fontWeight: "700",
    fontSize: 14,
  },
  historyTable: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  historyHeaderRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDataRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyHeader: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 11,
  },
  historyColDate: {
    width: 72,
    fontSize: 12,
    color: colors.ink,
  },
  historyColMerchant: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    fontWeight: "600",
  },
  historyColFrom: {
    width: 48,
    fontSize: 12,
    color: colors.ink,
  },
  historyColNum: {
    width: 52,
    fontSize: 12,
    color: colors.ink,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
