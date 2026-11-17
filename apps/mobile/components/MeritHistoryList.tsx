import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  formatMeritsCompactLabel,
  type MeritHistoryItem,
  type MeritHistorySourceKind,
} from "@civic/shared";
import { ProjectDetailModal } from "@/components/ProjectDetailModal";
import { colors } from "@/constants/theme";
import { getLocale, t } from "@/lib/i18n";

type Props = {
  items: MeritHistoryItem[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  onLoadMore: () => void;
};

function formatMe(n: number): string {
  const numLocale = getLocale() === "sk" ? "sk-SK" : "en-US";
  return formatMeritsCompactLabel(n, numLocale);
}

function formatHistoryDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("sk-SK");
}

function kindLabel(kind: MeritHistorySourceKind): string {
  if (kind === "report") return t("profile.history_source_report");
  if (kind === "purchase") return t("profile.history_source_purchase");
  return t("profile.history_source_project");
}

function sourceLine(item: MeritHistoryItem): string {
  const kind = kindLabel(item.source_kind);
  if (item.source_kind === "purchase" || !item.source_title) {
    return kind;
  }
  return `${kind} · ${item.source_title}`;
}

export function MeritHistoryList({
  items,
  total,
  loading,
  loadingMore,
  error,
  onLoadMore,
}: Props) {
  const [openNid, setOpenNid] = useState<string | null>(null);
  const [openTitle, setOpenTitle] = useState<string | null>(null);
  const canLoadMore = items.length < total;

  return (
    <View style={styles.section}>
      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.brand} />
      ) : error && items.length === 0 ? (
        <Text style={styles.empty}>{t("profile.history_error")}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t("profile.history_empty")}</Text>
      ) : (
        <>
          <View style={styles.table}>
            <View style={styles.header}>
              <Text style={[styles.th, styles.colDate]}>
                {t("profile.history_col_date")}
              </Text>
              <Text style={[styles.th, styles.colSource]}>
                {t("profile.history_col_source")}
              </Text>
              <Text style={[styles.th, styles.colMe]}>
                {t("profile.history_col_me")}
              </Text>
            </View>
            {items.map((row) => {
              const clickable = Boolean(row.project_nid);
              const negative = row.merits < 0;
              return (
                <Pressable
                  key={row.disbursement_nid}
                  style={styles.row}
                  disabled={!clickable}
                  onPress={() => {
                    if (!row.project_nid) return;
                    setOpenNid(row.project_nid);
                    setOpenTitle(row.source_title);
                  }}
                  accessibilityRole={clickable ? "button" : undefined}
                  accessibilityHint={
                    clickable ? t("project.open_hint") : undefined
                  }
                >
                  <Text style={[styles.td, styles.colDate]}>
                    {formatHistoryDate(row.created_at)}
                  </Text>
                  <Text
                    style={[
                      styles.td,
                      styles.colSource,
                      clickable && styles.tdLink,
                    ]}
                    numberOfLines={2}
                  >
                    {sourceLine(row)}
                  </Text>
                  <Text
                    style={[
                      styles.tdMe,
                      styles.colMe,
                      negative && styles.tdNegative,
                    ]}
                  >
                    {formatMe(row.merits)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.legend}>{t("profile.history_me_legend")}</Text>
        </>
      )}
      {canLoadMore ? (
        <Pressable
          style={styles.moreBtn}
          onPress={onLoadMore}
          disabled={loadingMore}
          accessibilityRole="button"
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={styles.moreText}>{t("profile.history_load_more")}</Text>
          )}
        </Pressable>
      ) : null}
      <ProjectDetailModal
        projectNid={openNid}
        fallbackTitle={openTitle}
        onClose={() => {
          setOpenNid(null);
          setOpenTitle(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  empty: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#EEF2EF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  row: {
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
  tdLink: {
    color: colors.brandSoft,
    fontWeight: "600",
  },
  tdMe: { fontSize: 14, fontWeight: "600", color: colors.ink },
  tdNegative: { color: colors.danger },
  colDate: { width: 78 },
  colSource: { flex: 1 },
  colMe: { width: 72, textAlign: "right" },
  legend: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  moreBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  moreText: { color: colors.brandSoft, fontWeight: "700" },
});
