import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  displayMerits,
  type MeritIndexFilters,
  type MeritIndexRow,
  type NaceExpertiseSection,
} from "@civic/shared";
import {
  ColumnFilterSheet,
  type ImpactFilterColumn,
  type ImpactFilters,
} from "@/components/ColumnFilterSheet";
import { MeritSourceBar } from "@/components/MeritSourceBar";
import { NaceExpertiseIcons } from "@/components/NaceExpertiseIcons";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMeritIndex } from "@/lib/api";
import { getLocale, t } from "@/lib/i18n";

const PAGE_SIZE = 50;

const DEFAULT_FILTERS: ImpactFilters = {
  sort: "total_me",
  order: "desc",
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function formatEur(n: number): string {
  return Math.round(n).toLocaleString("sk-SK");
}

function parseOptionalNumber(raw?: string): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function filtersToQuery(f: ImpactFilters, offset: number): MeritIndexFilters {
  return {
    limit: PAGE_SIZE,
    offset,
    sort: f.sort,
    order: f.order,
    country_iso2: f.country_iso2?.trim() || undefined,
    since_from: f.since_from?.trim() || undefined,
    min_me: parseOptionalNumber(f.min_me),
    max_me: parseOptionalNumber(f.max_me),
    min_value_eur: parseOptionalNumber(f.min_value_eur),
    max_value_eur: parseOptionalNumber(f.max_value_eur),
    nace_section_tid: f.nace_section_tid,
    source_category: f.source_category,
    lang: getLocale(),
  };
}

function buildIntro(f: ImpactFilters): string {
  const parts: string[] = [t("impact.intro_base")];
  const clauses: string[] = [];
  if (f.country_iso2) {
    clauses.push(
      t("impact.intro_country", {
        country: f.country_label ?? f.country_iso2,
      }),
    );
  }
  if (f.nace_section_label) {
    clauses.push(
      t("impact.intro_nace", { section: f.nace_section_label }),
    );
  }
  if (f.source_category) {
    const key =
      f.source_category === "taxes"
        ? "community.cat_taxes"
        : f.source_category === "charity"
          ? "community.cat_charity"
          : "community.cat_volunteer";
    clauses.push(t("impact.intro_source", { source: t(key) }));
  }
  if (clauses.length > 0) {
    parts.push(clauses.join(t("impact.intro_join")));
  }
  return parts.join("");
}

type FilterChip = {
  id: string;
  label: string;
  onClear: () => void;
};

function collectChips(f: ImpactFilters, onChange: (next: ImpactFilters) => void): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.country_iso2) {
    chips.push({
      id: "country",
      label: f.country_label ?? f.country_iso2,
      onClear: () =>
        onChange({ ...f, country_iso2: undefined, country_label: undefined }),
    });
  }
  if (f.since_from) {
    chips.push({
      id: "since",
      label: `${t("impact.chip_since")} ${f.since_from}`,
      onClear: () => onChange({ ...f, since_from: undefined }),
    });
  }
  if (f.min_me || f.max_me) {
    chips.push({
      id: "me",
      label: t("impact.chip_me_range"),
      onClear: () => onChange({ ...f, min_me: undefined, max_me: undefined }),
    });
  }
  if (f.min_value_eur || f.max_value_eur) {
    chips.push({
      id: "eur",
      label: t("impact.chip_eur_range"),
      onClear: () =>
        onChange({ ...f, min_value_eur: undefined, max_value_eur: undefined }),
    });
  }
  if (f.nace_section_tid) {
    chips.push({
      id: "nace",
      label: f.nace_section_label ?? String(f.nace_section_tid),
      onClear: () =>
        onChange({
          ...f,
          nace_section_tid: undefined,
          nace_section_label: undefined,
        }),
    });
  }
  if (f.source_category) {
    const key =
      f.source_category === "taxes"
        ? "community.cat_taxes"
        : f.source_category === "charity"
          ? "community.cat_charity"
          : "community.cat_volunteer";
    chips.push({
      id: "source",
      label: t(key),
      onClear: () => onChange({ ...f, source_category: undefined }),
    });
  }
  return chips;
}

function collectNaceOptions(rows: MeritIndexRow[]): NaceExpertiseSection[] {
  const map = new Map<number, NaceExpertiseSection>();
  for (const row of rows) {
    for (const section of row.nace_expertise) {
      if (!map.has(section.section_tid)) {
        map.set(section.section_tid, section);
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.section_label.localeCompare(b.section_label, getLocale()),
  );
}

export default function ImpactScreen() {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const [filters, setFilters] = useState<ImpactFilters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<MeritIndexRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterColumn, setFilterColumn] = useState<ImpactFilterColumn | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  const naceOptions = useMemo(() => collectNaceOptions(rows), [rows]);
  const intro = useMemo(() => buildIntro(filters), [filters]);
  const chips = useMemo(
    () => collectChips(filters, setFilters),
    [filters],
  );

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!signedIn) return;
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
        if (!append && page.items.length > 0) {
          const countryMatch = filters.country_iso2
            ? page.items.find(
                (r) => r.country_iso2 === filters.country_iso2?.toUpperCase(),
              )
            : null;
          if (countryMatch?.country_label && !filters.country_label) {
            setFilters((f) => ({
              ...f,
              country_label: countryMatch.country_label ?? undefined,
            }));
          }
        }
      } catch {
        setError(t("impact.load_error"));
        if (!append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [signedIn, filters],
  );

  useEffect(() => {
    if (!signedIn) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadPage(0, false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, signedIn, loadPage]);

  function openProfile(username: string) {
    router.push(`/(tabs)/community/${encodeURIComponent(username)}`);
  }

  function openFilter(column: ImpactFilterColumn) {
    setFilterColumn(column);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function loadMore() {
    if (loadingMore || rows.length >= total) return;
    void loadPage(offsetRef.current + PAGE_SIZE, true);
  }

  function HeaderCell({
    column,
    label,
    width,
    filterable = true,
  }: {
    column?: ImpactFilterColumn;
    label: string;
    width: number;
    filterable?: boolean;
  }) {
    const content = (
      <Text style={styles.th} numberOfLines={2}>
        {label}
      </Text>
    );
    if (!filterable || !column) {
      return <View style={[styles.thWrap, { width }]}>{content}</View>;
    }
    return (
      <Pressable
        style={[styles.thWrap, { width }]}
        onPress={() => openFilter(column)}
        accessibilityRole="button"
      >
        {content}
        <MaterialIcons name="filter-list" size={14} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{intro}</Text>

      {!signedIn ? (
        <View style={styles.authBox}>
          <Text style={styles.hint}>{t("impact.sign_in_hint")}</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryText}>{t("home.sign_in")}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {signedIn && chips.length > 0 ? (
        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <Pressable key={chip.id} style={styles.chip} onPress={chip.onClear}>
              <Text style={styles.chipText}>{chip.label}</Text>
              <MaterialIcons name="close" size={16} color={colors.brandSoft} />
            </Pressable>
          ))}
          <Pressable style={styles.chipReset} onPress={resetFilters}>
            <Text style={styles.chipResetText}>{t("impact.reset_filters")}</Text>
          </Pressable>
        </View>
      ) : null}

      {signedIn && loading && rows.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 24 }} />
      ) : null}

      {signedIn && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {signedIn && !loading && rows.length === 0 && !error ? (
        <Text style={styles.hint}>{t("impact.empty")}</Text>
      ) : null}

      {signedIn && rows.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <HeaderCell column="position" label="#" width={40} />
              <HeaderCell label={t("impact.col_worker")} width={128} filterable={false} />
              <HeaderCell column="total_me" label={t("impact.col_me")} width={72} />
              <HeaderCell column="value_eur" label={t("impact.col_eur")} width={64} />
              <HeaderCell column="country" label={t("impact.col_country")} width={88} />
              <HeaderCell column="nace" label={t("impact.col_nace")} width={120} />
              <HeaderCell column="sources" label={t("impact.col_sources")} width={72} />
            </View>
            {rows.map((row) => (
              <Pressable
                key={row.rovas_uid}
                style={styles.tableRow}
                onPress={() => openProfile(row.username)}
              >
                <Text style={[styles.td, styles.colPos]}>{row.position}</Text>
                <View style={styles.colWorker}>
                  <Text style={styles.tdLink} numberOfLines={1}>
                    @{row.username}
                  </Text>
                  <Text style={styles.sinceHint}>{row.member_since_year}</Text>
                </View>
                <Text style={[styles.td, styles.colMe]}>
                  {formatMe(row.total_me)}
                </Text>
                <Text style={[styles.td, styles.colEur]}>
                  {formatEur(row.value_eur)}
                </Text>
                <Text style={[styles.td, styles.colCountry]} numberOfLines={1}>
                  {row.country_iso2 ?? "—"}
                </Text>
                <View style={styles.colNace}>
                  <NaceExpertiseIcons
                    sections={row.nace_expertise}
                    iconSize={28}
                  />
                </View>
                <View style={styles.colSources}>
                  <MeritSourceBar by={row.by_category} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {signedIn && rows.length > 0 && rows.length < total ? (
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

      <Text style={styles.footer}>{t("impact.footer")}</Text>

      <ColumnFilterSheet
        visible={filterColumn != null}
        column={filterColumn}
        filters={filters}
        naceOptions={naceOptions}
        onChange={setFilters}
        onClose={() => setFilterColumn(null)}
      />
    </ScrollView>
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
  authBox: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EEF2EF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  chipReset: { paddingVertical: 6, paddingHorizontal: 4 },
  chipResetText: {
    fontSize: 13,
    color: colors.brandSoft,
    fontWeight: "600",
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    minWidth: 640,
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
  sinceHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  colPos: { width: 40, textAlign: "center" },
  colWorker: { width: 128 },
  colMe: { width: 72, textAlign: "right" },
  colEur: { width: 64, textAlign: "right" },
  colCountry: { width: 88 },
  colNace: { width: 120, overflow: "hidden" },
  colSources: { width: 72, justifyContent: "center" },
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
  footer: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 4,
  },
});
