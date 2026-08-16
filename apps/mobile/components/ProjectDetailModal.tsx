import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { displayMerits, type ProjectDetail, type ProjectWorkReportItem } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchProject, fetchProjectWorkReports } from "@/lib/api";
import { t } from "@/lib/i18n";

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

export function ProjectDetailModal({
  projectNid,
  fallbackTitle,
  onClose,
}: Props) {
  const visible = projectNid != null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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
  }, [projectNid]);

  const loadMore = useCallback(async () => {
    if (!projectNid || !detail || loadingMore) return;
    const nextOffset = detail.work_reports.offset + detail.work_reports.limit;
    if (nextOffset >= detail.work_reports.total) return;
    setLoadingMore(true);
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
      // Keep existing list; user can retry via Load more.
    } finally {
      setLoadingMore(false);
    }
  }, [projectNid, detail, loadingMore]);

  const title =
    detail?.title ?? fallbackTitle?.trim() ?? t("project.detail_title");
  const hasMore =
    detail != null &&
    detail.work_reports.items.length < detail.work_reports.total;

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
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
          >
            {!detail.is_public ? (
              <Text style={styles.hint}>{t("project.private_hint")}</Text>
            ) : null}

            {detail.summary ? (
              <Text style={styles.summary}>{detail.summary}</Text>
            ) : detail.is_public ? (
              <Text style={styles.hint}>{t("project.no_summary")}</Text>
            ) : null}

            <View style={styles.metaBlock}>
              {(detail.owner_display_name || detail.owner_username) &&
              detail.is_public ? (
                <MetaRow
                  label={t("project.owner")}
                  value={
                    detail.owner_display_name ||
                    (detail.owner_username
                      ? `@${detail.owner_username}`
                      : "—")
                  }
                />
              ) : null}
              {detail.is_public && detail.total_hours != null ? (
                <MetaRow
                  label={t("project.total_hours")}
                  value={formatHours(detail.total_hours)}
                />
              ) : null}
              {detail.is_public && detail.total_me != null ? (
                <MetaRow
                  label={t("project.total_me")}
                  value={`${formatMe(detail.total_me)} ${t("common.me")}`}
                />
              ) : null}
              {detail.is_public ? (
                <MetaRow
                  label={t("project.work_reports")}
                  value={String(detail.work_report_count)}
                />
              ) : null}
            </View>

            {detail.is_public ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("project.work_reports")}
                </Text>
                {detail.work_reports.items.length === 0 ? (
                  <Text style={styles.hint}>{t("project.work_reports_empty")}</Text>
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
                    />
                  ))
                )}
                {hasMore ? (
                  <Pressable
                    onPress={() => void loadMore()}
                    disabled={loadingMore}
                    style={styles.loadMore}
                    accessibilityRole="button"
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : (
                      <Text style={styles.loadMoreText}>
                        {t("project.load_more")}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
        ) : null}
      </View>
    </Modal>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function WorkReportRow({
  item,
  expanded,
  onToggle,
}: {
  item: ProjectWorkReportItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const author =
    item.author_display_name ||
    (item.author_username ? `@${item.author_username}` : null);
  const date = formatIsoDate(item.created_at);

  return (
    <View style={styles.wrCard}>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Text style={styles.wrTitle}>{item.title}</Text>
        <View style={styles.wrMeta}>
          {item.hours != null ? (
            <Text style={styles.wrMetaText}>
              {formatHours(item.hours)} {t("project.hours_unit")}
            </Text>
          ) : null}
          {author ? <Text style={styles.wrMetaText}>{author}</Text> : null}
          {date ? <Text style={styles.wrMetaText}>{date}</Text> : null}
        </View>
        <Text style={styles.wrToggle}>
          {expanded ? t("project.collapse_report") : t("project.expand_report")}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.wrDetail}>
          {item.summary ? (
            <Text style={styles.wrSummary}>{item.summary}</Text>
          ) : (
            <Text style={styles.hint}>{t("project.no_report_summary")}</Text>
          )}
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
    paddingBottom: 40,
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
  metaRow: { gap: 2 },
  metaLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
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
  },
  wrSummary: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
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
