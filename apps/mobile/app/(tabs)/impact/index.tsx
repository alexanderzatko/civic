import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  displayMerits,
  type MeritIndexFilters,
  type MeritIndexRow,
} from "@civic/shared";
import {
  ImpactFilterBar,
  type ImpactFilters,
} from "@/components/ImpactFilterBar";
import { MeritSourceBar } from "@/components/MeritSourceBar";
import { NaceExpertiseIcons } from "@/components/NaceExpertiseIcons";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMeritIndex } from "@/lib/api";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const PAGE_SIZE = 50;

const DEFAULT_FILTERS: ImpactFilters = {
  sort: "total_me",
  order: "desc",
  period: null,
};

function formatMe(n: number, locale: Locale): string {
  const numLocale = locale === "sk" ? "sk-SK" : "en-US";
  return displayMerits(n).toLocaleString(numLocale);
}

/**
 * ME amount matching the active Merit-subset filter, when available.
 * - source_category → by_category[source] (always present on rows)
 * - nace_section_tid alone → matching nace_expertise[].me when that section
 *   is among the top expertise rows Rovas returns (else null)
 * Country (and other) filters do not subset Merits — return null.
 */
function filteredMeForRow(
  row: MeritIndexRow,
  filters: ImpactFilters,
): number | null {
  if (filters.source_category) {
    const v = row.by_category[filters.source_category];
    return typeof v === "number" ? v : null;
  }
  if (filters.nace_section_tid != null && !filters.period) {
    const section = row.nace_expertise.find(
      (s) => Number(s.section_tid) === filters.nace_section_tid,
    );
    return section != null ? section.me : null;
  }
  return null;
}

function filtersToQuery(f: ImpactFilters, offset: number): MeritIndexFilters {
  const period = f.period ?? undefined;
  return {
    limit: PAGE_SIZE,
    offset,
    sort: f.sort,
    order: f.order,
    min_me: period ? undefined : 1,
    country_iso2: f.country_iso2?.trim() || undefined,
    nace_section_tid: period ? undefined : f.nace_section_tid,
    source_category: f.source_category,
    period,
    lang: getLocale(),
  };
}

function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export default function ImpactScreen() {
  const { status } = useAuth();
  const { locale } = useLocale();
  const signedIn = status === "signedIn";
  const [filters, setFilters] = useState<ImpactFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<MeritIndexRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await fetchMeritIndex(filtersToQuery(filters, offset));
        offsetRef.current = offset;
        setTotal(page.total);
        setRows((prev) =>
          append ? [...prev, ...page.items] : page.items,
        );
      } catch {
        setError(t("impact.load_error"));
        if (!append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters, locale],
  );

  useEffect(() => {
    // Immediate feedback on filter tap — do not leave stale rows visible for
    // the ~350ms debounce + multi-second Rovas round-trip with no spinner.
    setLoading(true);
    setError(null);
    setRows([]);
    setTotal(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadPage(0, false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, loadPage]);

  function openProfile(username: string) {
    if (!signedIn) return;
    router.push(`/(tabs)/community/${encodeURIComponent(username)}`);
  }

  function loadMore() {
    if (loading || loadingMore || rows.length >= total) return;
    void loadPage(offsetRef.current + PAGE_SIZE, true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t("impact.intro_base")}</Text>

      <ImpactFilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 24 }} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && rows.length === 0 && !error ? (
        <Text style={styles.hint}>{t("impact.empty")}</Text>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <HeaderCell label={t("impact.col_position")} width={40} />
              <HeaderCell label={t("impact.col_worker")} width={128} />
              <HeaderCell label={t("impact.col_me")} width={80} />
              <HeaderCell label={t("impact.col_nace")} width={108} />
              <HeaderCell label={t("impact.col_sources")} width={88} />
              <HeaderCell label={t("impact.col_country")} width={56} />
            </View>
            {rows.map((row) => {
              const filteredMe = filteredMeForRow(row, filters);
              const rowContent = (
                <>
                  <Text style={[styles.td, styles.colPos]}>{row.position}</Text>
                  <View style={styles.colWorker}>
                    <Text
                      style={signedIn ? styles.tdLink : styles.tdUsername}
                      numberOfLines={1}
                    >
                      @{row.username}
                    </Text>
                    <Text style={styles.sinceHint}>
                      {interpolate(t("impact.member_since"), {
                        year: String(row.member_since_year),
                      })}
                    </Text>
                  </View>
                  <View style={styles.colMe}>
                    {filteredMe != null ? (
                      <>
                        <Text style={[styles.td, styles.colMePrimary]}>
                          {formatMe(filteredMe, locale)}
                        </Text>
                        <Text style={styles.colMeTotal}>
                          {formatMe(row.total_me, locale)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.td, styles.colMePrimary]}>
                        {formatMe(row.total_me, locale)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.colNace}>
                    <NaceExpertiseIcons
                      sections={row.nace_expertise}
                      iconSize={28}
                      maxIcons={3}
                      align="start"
                      gap={3}
                      compact
                    />
                  </View>
                  <View style={styles.colSources}>
                    <MeritSourceBar by={row.by_category} />
                  </View>
                  <Text style={[styles.td, styles.colCountry]} numberOfLines={1}>
                    {row.country_iso2 ?? "—"}
                  </Text>
                </>
              );

              if (signedIn) {
                return (
                  <Pressable
                    key={row.rovas_uid}
                    style={styles.tableRow}
                    onPress={() => openProfile(row.username)}
                  >
                    {rowContent}
                  </Pressable>
                );
              }

              return (
                <View key={row.rovas_uid} style={styles.tableRow}>
                  {rowContent}
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {rows.length > 0 && rows.length < total ? (
        <Pressable
          style={styles.loadMoreBtn}
          onPress={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={styles.loadMoreText}>{t("impact.load_more")}</Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function HeaderCell({ label, width }: { label: string; width: number }) {
  return (
    <View style={[styles.thWrap, { width }]}>
      <Text style={styles.th} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    minWidth: 588,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EEF2EF",
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
  },
  thWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  th: { fontSize: 11, fontWeight: "600", color: colors.muted, flexShrink: 1 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
    alignItems: "center",
  },
  td: { fontSize: 13, color: colors.ink },
  tdLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brandSoft,
  },
  tdUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  sinceHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  colPos: { width: 40, textAlign: "center" },
  colWorker: { width: 128 },
  colMe: {
    width: 80,
    paddingRight: 10,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  colMePrimary: {
    textAlign: "right",
    fontWeight: "700",
  },
  colMeTotal: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: colors.muted,
    textAlign: "right",
  },
  colCountry: { width: 56 },
  colNace: { width: 108, overflow: "hidden", alignItems: "flex-start" },
  colSources: { width: 88, justifyContent: "center" },
  loadMoreBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 140,
    alignItems: "center",
  },
  loadMoreText: {
    color: colors.brandSoft,
    fontWeight: "700",
    fontSize: 14,
  },
});
