import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  displayMerits,
  type ProjectDetail,
  type ProjectShareholderItem,
  type ProjectWorkReportItem,
} from "@civic/shared";
import { GiftPaymentForm } from "@/components/GiftPaymentForm";
import { colors } from "@/constants/theme";
import {
  fetchProject,
  fetchProjectShareholders,
  fetchProjectWorkReports,
} from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const FOCUS_SCROLL_PAD = 24;
const CONTENT_BOTTOM_PAD = 40;

type Props = {
  projectNid: string | null;
  /** Fallback title while loading / if detail is restricted. */
  fallbackTitle?: string | null;
  onClose: () => void;
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function formatHours(n: number): string {
  return n.toLocaleString("sk-SK", {
    maximumFractionDigits: 2,
  });
}

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sk-SK");
}

function formatShareKind(item: ProjectShareholderItem): string {
  if (item.share_kind === "percent" && item.share_percent != null) {
    return `${item.share_percent.toLocaleString("sk-SK", {
      maximumFractionDigits: 1,
    })} %`;
  }
  return t("project.share_time_based");
}

function formatShareHours(item: ProjectShareholderItem): string {
  if (item.hours == null) return "—";
  return `${formatHours(item.hours)} ${t("project.hours_unit")}`;
}

export function ProjectDetailModal({
  projectNid,
  fallbackTitle,
  onClose,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const visible = projectNid != null;
  const scrollRef = useRef<ScrollView>(null);
  const scrollHostRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const focusedFieldRef = useRef<TextInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingMoreWr, setLoadingMoreWr] = useState(false);
  const [loadingMoreSh, setLoadingMoreSh] = useState(false);

  const scrollFieldIntoView = useCallback((field: TextInput | null) => {
    focusedFieldRef.current = field;
    if (!field) return;
    const run = () => {
      if (!field || !scrollRef.current || !scrollHostRef.current) return;
      field.measureInWindow((_x, y, _w, h) => {
        scrollHostRef.current?.measureInWindow((_sx, sy, _sw, sh) => {
          // pageSheet Modals often leave the ScrollView full-height behind the
          // keyboard, so measure host vs screen-minus-keyboard — not host alone.
          const screenBottom =
            Dimensions.get("window").height - keyboardHeightRef.current;
          const visibleBottom =
            Math.min(sy + sh, screenBottom) - FOCUS_SCROLL_PAD;
          const overlap = y + h - visibleBottom;
          if (overlap <= 0) return;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollYRef.current + overlap),
            animated: true,
          });
        });
      });
    };
    // Keyboard frame arrives after focus; nudge twice across the animation.
    setTimeout(run, 50);
    setTimeout(run, 320);
  }, []);

  useEffect(() => {
    if (!visible) {
      keyboardHeightRef.current = 0;
      focusedFieldRef.current = null;
      return;
    }
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      if (focusedFieldRef.current) {
        scrollFieldIntoView(focusedFieldRef.current);
      }
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible, scrollFieldIntoView]);

  useEffect(() => {
    if (!projectNid) {
      setDetail(null);
      setError(null);
      setLoading(false);
      setExpandedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setExpandedId(null);
    void fetchProject(projectNid)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return;
        if (err.status === 404) {
          setError(t("project.error_not_found"));
        } else {
          setError(t("project.error_api"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectNid, locale]);

  const openUser = useCallback(
    (username: string) => {
      onClose();
      router.push(`/(tabs)/community/${encodeURIComponent(username)}`);
    },
    [onClose, router],
  );

  const loadMoreWorkReports = useCallback(async () => {
    if (!projectNid || !detail || loadingMoreWr) return;
    const nextOffset = detail.work_reports.offset + detail.work_reports.limit;
    if (nextOffset >= detail.work_reports.total) return;
    setLoadingMoreWr(true);
    try {
      const page = await fetchProjectWorkReports(projectNid, {
        limit: detail.work_reports.limit,
        offset: nextOffset,
      });
      setDetail((prev) => {
        if (!prev) return prev;
        const seen = new Set(
          prev.work_reports.items.map((i) => i.work_report_nid),
        );
        const merged = [
          ...prev.work_reports.items,
          ...page.items.filter((i) => !seen.has(i.work_report_nid)),
        ];
        return {
          ...prev,
          work_reports: {
            ...page,
            items: merged,
            offset: nextOffset,
          },
        };
      });
    } catch {
      // Keep existing list.
    } finally {
      setLoadingMoreWr(false);
    }
  }, [projectNid, detail, loadingMoreWr]);

  const loadMoreShareholders = useCallback(async () => {
    if (!projectNid || !detail || loadingMoreSh) return;
    const nextOffset =
      detail.shareholders.offset + detail.shareholders.limit;
    if (nextOffset >= detail.shareholders.total) return;
    setLoadingMoreSh(true);
    try {
      const page = await fetchProjectShareholders(projectNid, {
        limit: detail.shareholders.limit,
        offset: nextOffset,
      });
      setDetail((prev) => {
        if (!prev) return prev;
        const seen = new Set(prev.shareholders.items.map((i) => i.username));
        const merged = [
          ...prev.shareholders.items,
          ...page.items.filter((i) => !seen.has(i.username)),
        ];
        return {
          ...prev,
          shareholders: {
            ...page,
            items: merged,
            offset: nextOffset,
          },
        };
      });
    } catch {
      // Keep existing list.
    } finally {
      setLoadingMoreSh(false);
    }
  }, [projectNid, detail, loadingMoreSh]);

  const title =
    detail?.title ?? fallbackTitle?.trim() ?? t("project.detail_title");
  const hasMoreWr =
    detail != null &&
    detail.work_reports.items.length < detail.work_reports.total;
  const hasMoreSh =
    detail != null &&
    detail.shareholders.items.length < detail.shareholders.total;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.close}>{t("common.close")}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.loadingText}>{t("project.loading")}</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : detail ? (
          <View ref={scrollHostRef} style={styles.scrollHost}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {detail.summary ? (
              <Text style={styles.summary}>{detail.summary}</Text>
            ) : (
              <Text style={styles.hint}>{t("project.no_summary")}</Text>
            )}

            <View style={styles.metaBlock}>
              {detail.owner_username ? (
                <MetaRow
                  label={t("project.owner")}
                  value={`@${detail.owner_username}`}
                  onValuePress={() => openUser(detail.owner_username!)}
                />
              ) : null}
              {detail.organization ? (
                <MetaRow
                  label={t("project.organization")}
                  value={detail.organization}
                />
              ) : null}
              {detail.total_hours != null ? (
                <MetaRow
                  label={t("project.total_hours")}
                  value={formatHours(detail.total_hours)}
                />
              ) : null}
              {detail.total_me != null ? (
                <MetaRow
                  label={t("project.total_me")}
                  value={`${formatMe(detail.total_me)} ${t("common.me")}`}
                />
              ) : null}
              <MetaRow
                label={t("project.work_ledgers")}
                value={String(detail.work_report_count)}
              />
              <MetaRow
                label={t("project.shareholders")}
                value={String(detail.shareholder_count)}
              />
            </View>

            {detail.is_charity ? (
              <View style={styles.donateBlock}>
                <Text style={styles.sectionTitle}>{t("project.donate_title")}</Text>
                {detail.donate_instructions ? (
                  <Text style={styles.donateInstructions}>
                    {detail.donate_instructions}
                  </Text>
                ) : (
                  <Text style={styles.hint}>{t("project.donate_none")}</Text>
                )}
                {detail.donate_url ? (
                  <Pressable
                    onPress={() => void Linking.openURL(detail.donate_url!)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>{t("project.donate_open")} →</Text>
                  </Pressable>
                ) : null}
                {detail.charity_status === "approved" &&
                detail.donate_iban ? (
                  <GiftPaymentForm
                    projectNid={detail.project_nid}
                    donateIban={detail.donate_iban}
                    beneficiaryName={
                      detail.organization?.trim() || detail.title
                    }
                    onAmountFocus={scrollFieldIntoView}
                  />
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("project.shareholders")}
                </Text>
                {detail.shareholders.items.length === 0 ? (
                  <Text style={styles.hint}>
                    {t("project.shareholders_empty")}
                  </Text>
                ) : (
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, styles.colUser]}>
                        {t("project.col_user")}
                      </Text>
                      <Text style={[styles.th, styles.colShare]}>
                        {t("project.col_share")}
                      </Text>
                      <Text style={[styles.th, styles.colTime]}>
                        {t("project.col_time")}
                      </Text>
                    </View>
                    {detail.shareholders.items.map((item) => (
                      <View key={item.username} style={styles.tableRow}>
                        <Pressable
                          style={styles.colUser}
                          onPress={() => openUser(item.username)}
                          accessibilityRole="link"
                        >
                          <Text style={[styles.td, styles.userLink]} numberOfLines={1}>
                            @{item.username}
                          </Text>
                        </Pressable>
                        <Text style={[styles.td, styles.colShare]} numberOfLines={2}>
                          {formatShareKind(item)}
                        </Text>
                        <Text style={[styles.td, styles.colTime]}>
                          {formatShareHours(item)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {hasMoreSh ? (
                  <Pressable
                    onPress={() => void loadMoreShareholders()}
                    disabled={loadingMoreSh}
                    style={styles.loadMore}
                    accessibilityRole="button"
                  >
                    {loadingMoreSh ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : (
                      <Text style={styles.loadMoreText}>
                        {t("project.load_more")}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("project.work_ledgers")}
                </Text>
                {detail.work_reports.items.length === 0 ? (
                  <Text style={styles.hint}>
                    {t("project.work_ledgers_empty")}
                  </Text>
                ) : (
                  detail.work_reports.items.map((item) => (
                    <WorkReportRow
                      key={item.work_report_nid}
                      item={item}
                      expanded={expandedId === item.work_report_nid}
                      onToggle={() =>
                        setExpandedId((cur) =>
                          cur === item.work_report_nid
                            ? null
                            : item.work_report_nid,
                        )
                      }
                      onOpenUser={openUser}
                    />
                  ))
                )}
                {hasMoreWr ? (
                  <Pressable
                    onPress={() => void loadMoreWorkReports()}
                    disabled={loadingMoreWr}
                    style={styles.loadMore}
                    accessibilityRole="button"
                  >
                    {loadingMoreWr ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : (
                      <Text style={styles.loadMoreText}>
                        {t("project.load_more")}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
            </View>

            {detail.rovas_url ? (
              <Pressable
                onPress={() => void Linking.openURL(detail.rovas_url)}
                style={styles.openRovas}
                accessibilityRole="link"
              >
                <Text style={styles.openRovasText}>
                  {t("project.open_rovas")}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function MetaRow({
  label,
  value,
  onValuePress,
}: {
  label: string;
  value: string;
  onValuePress?: () => void;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      {onValuePress ? (
        <Pressable onPress={onValuePress} accessibilityRole="link">
          <Text style={[styles.metaValue, styles.userLink]}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={styles.metaValue}>{value}</Text>
      )}
    </View>
  );
}

function WorkReportRow({
  item,
  expanded,
  onToggle,
  onOpenUser,
}: {
  item: ProjectWorkReportItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenUser: (username: string) => void;
}) {
  const date = formatIsoDate(item.created_at);
  const photos = item.photo_urls ?? [];

  return (
    <View style={styles.wrCard}>
      <Text style={styles.wrTitle}>{item.title}</Text>
      <View style={styles.wrMeta}>
        {date ? <Text style={styles.wrMetaText}>{date}</Text> : null}
        {item.author_username ? (
          <Pressable
            onPress={() => onOpenUser(item.author_username!)}
            accessibilityRole="link"
            hitSlop={6}
          >
            <Text style={[styles.wrMetaText, styles.userLink]}>
              @{item.author_username}
            </Text>
          </Pressable>
        ) : null}
        {item.hours != null ? (
          <Text style={styles.wrMetaText}>
            {formatHours(item.hours)} {t("project.hours_unit")}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Text style={styles.wrToggle}>
          {expanded
            ? t("project.collapse_ledger")
            : t("project.expand_ledger")}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.wrDetail}>
          {item.summary ? (
            <Text style={styles.wrSummary}>{item.summary}</Text>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollHost: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  close: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brandSoft,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: CONTENT_BOTTOM_PAD,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: { color: colors.muted },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  hint: { fontSize: 13, color: colors.muted },
  metaBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  donateBlock: {
    backgroundColor: colors.catCharitySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  donateInstructions: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  link: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
  },
  userLink: {
    color: colors.brandSoft,
    fontWeight: "600",
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EEF2EF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  th: { fontSize: 12, fontWeight: "600", color: colors.muted },
  td: { fontSize: 13, color: colors.ink },
  colUser: { flex: 1.2, minWidth: 0 },
  colShare: { flex: 1, textAlign: "right" },
  colTime: { width: 72, textAlign: "right" },
  wrCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 6,
  },
  wrTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  wrMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  wrMetaText: {
    fontSize: 12,
    color: colors.muted,
  },
  wrToggle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brandSoft,
    marginTop: 2,
  },
  wrDetail: {
    paddingTop: 6,
    paddingBottom: 2,
    gap: 10,
  },
  wrSummary: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  photoRow: {
    gap: 8,
    paddingVertical: 2,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  loadMore: {
    alignItems: "center",
    paddingVertical: 10,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandSoft,
  },
  openRovas: {
    alignItems: "center",
    paddingVertical: 12,
  },
  openRovasText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandSoft,
  },
});
