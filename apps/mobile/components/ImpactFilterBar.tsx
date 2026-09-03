import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  MeritIndexCountry,
  MeritIndexOrder,
  MeritIndexSort,
  MeritSourceCategory,
  NaceNode,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchMeritIndexCountries, fetchNaceTree } from "@/lib/api";
import { naceLetterSections } from "@/lib/nace-sections";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

export type ImpactFilters = {
  sort: MeritIndexSort;
  order: MeritIndexOrder;
  country_iso2?: string;
  country_label?: string;
  nace_section_tid?: number;
  nace_section_label?: string;
  source_category?: MeritSourceCategory;
};

type Props = {
  filters: ImpactFilters;
  onChange: (next: ImpactFilters) => void;
};

const SOURCE_OPTIONS: Array<{
  id: MeritSourceCategory | null;
  labelKey: string;
  color?: string;
  background?: string;
}> = [
  { id: null, labelKey: "impact.source_all" },
  {
    id: "taxes",
    labelKey: "community.cat_taxes",
    color: colors.catTaxes,
    background: colors.catTaxesSoft,
  },
  {
    id: "charity",
    labelKey: "community.cat_charity",
    color: colors.catCharity,
    background: colors.catCharitySoft,
  },
  {
    id: "volunteer",
    labelKey: "community.cat_volunteer",
    color: colors.catVolunteer,
    background: colors.catVolunteerSoft,
  },
];

function Chip({
  label,
  active,
  color,
  background,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  background?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        color ? { borderColor: color, backgroundColor: background } : null,
        active && !color ? styles.chipActive : null,
        active ? styles.chipSelected : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.chipText,
          color ? { color } : null,
          active && !color ? styles.chipTextActive : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterPicker({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Pressable
        style={styles.picker}
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={styles.pickerText} numberOfLines={1}>
          {value}
        </Text>
        <MaterialIcons name="expand-more" size={22} color={colors.muted} />
      </Pressable>
    </View>
  );
}

export function ImpactFilterBar({ filters, onChange }: Props) {
  const { locale } = useLocale();
  const [countries, setCountries] = useState<MeritIndexCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [naceTree, setNaceTree] = useState<NaceNode[]>([]);
  const [naceLoading, setNaceLoading] = useState(false);
  const [naceOpen, setNaceOpen] = useState(false);

  const naceSections = useMemo(
    () => naceLetterSections(naceTree),
    [naceTree],
  );

  useEffect(() => {
    let cancelled = false;
    setCountriesLoading(true);
    void fetchMeritIndexCountries()
      .then((res) => {
        if (!cancelled) setCountries(res.countries);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    setNaceLoading(true);
    void fetchNaceTree()
      .then((res) => {
        if (!cancelled) setNaceTree(res.tree);
      })
      .catch(() => {
        if (!cancelled) setNaceTree([]);
      })
      .finally(() => {
        if (!cancelled) setNaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  function patch(partial: Partial<ImpactFilters>) {
    onChange({ ...filters, ...partial });
  }

  const countryLabel = filters.country_iso2
    ? countries.find((c) => c.iso2 === filters.country_iso2)?.label ??
      filters.country_label ??
      filters.country_iso2
    : t("impact.country_all");

  const naceLabel = filters.nace_section_tid
    ? naceSections.find((n) => Number(n.tid) === filters.nace_section_tid)
        ?.label ??
      filters.nace_section_label ??
      t("impact.filter_nace_any")
    : t("impact.filter_nace_any");

  return (
    <View style={styles.wrap}>
      <FilterPicker
        label={t("impact.filter_country")}
        value={countryLabel}
        onPress={() => setCountryOpen(true)}
      />

      <Text style={styles.sectionLabel}>{t("impact.filter_source")}</Text>
      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map((opt) => {
          const active =
            (opt.id ?? undefined) === (filters.source_category ?? undefined);
          return (
            <Chip
              key={opt.labelKey}
              label={t(opt.labelKey)}
              active={active}
              color={opt.color}
              background={opt.background}
              onPress={() =>
                patch({
                  source_category: opt.id ?? undefined,
                  sort: opt.id
                    ? (`${opt.id}_me` as MeritIndexSort)
                    : "total_me",
                })
              }
            />
          );
        })}
      </View>

      <FilterPicker
        label={t("impact.filter_nace")}
        value={naceLabel}
        onPress={() => setNaceOpen(true)}
      />

      <Modal
        visible={countryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setCountryOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("impact.filter_country")}</Text>
            <Pressable onPress={() => setCountryOpen(false)} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          {countriesLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.sheetLoader} />
          ) : (
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Pressable
                style={[
                  styles.optionRow,
                  !filters.country_iso2 && styles.optionRowActive,
                ]}
                onPress={() => {
                  patch({
                    country_iso2: undefined,
                    country_label: undefined,
                  });
                  setCountryOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    !filters.country_iso2 && styles.optionTextActive,
                  ]}
                >
                  {t("impact.country_all")}
                </Text>
              </Pressable>
              {countries.map((country) => {
                const active = filters.country_iso2 === country.iso2;
                return (
                  <Pressable
                    key={country.iso2}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      patch({
                        country_iso2: active ? undefined : country.iso2,
                        country_label: active ? undefined : country.label,
                      });
                      setCountryOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                    >
                      {country.label}
                    </Text>
                  </Pressable>
                );
              })}
              {!countriesLoading && countries.length === 0 ? (
                <Text style={styles.hint}>{t("impact.countries_empty")}</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={naceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNaceOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setNaceOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("impact.filter_nace")}</Text>
            <Pressable onPress={() => setNaceOpen(false)} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          {naceLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.sheetLoader} />
          ) : (
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Pressable
                style={[
                  styles.optionRow,
                  !filters.nace_section_tid && styles.optionRowActive,
                ]}
                onPress={() => {
                  patch({
                    nace_section_tid: undefined,
                    nace_section_label: undefined,
                  });
                  setNaceOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    !filters.nace_section_tid && styles.optionTextActive,
                  ]}
                >
                  {t("impact.filter_nace_any")}
                </Text>
              </Pressable>
              {naceSections.map((node) => {
                const tid = Number(node.tid);
                const active = filters.nace_section_tid === tid;
                const optionLabel = node.code
                  ? `${node.code} — ${node.label}`
                  : node.label;
                return (
                  <Pressable
                    key={node.tid}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      patch({
                        nace_section_tid: active ? undefined : tid,
                        nace_section_label: active ? undefined : node.label,
                      });
                      setNaceOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                    >
                      {optionLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerBlock: { gap: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: "#EEF2EF",
    borderColor: colors.brand,
  },
  chipSelected: {
    borderWidth: 2.5,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.brandSoft },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  pickerText: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    marginRight: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    maxHeight: "60%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, flex: 1 },
  sheetLoader: { marginVertical: 24 },
  sheetBody: { padding: 16, gap: 8 },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: {
    borderColor: colors.brand,
    backgroundColor: "#EEF2EF",
  },
  optionText: { fontSize: 15, color: colors.ink },
  optionTextActive: { fontWeight: "600", color: colors.brandSoft },
});
