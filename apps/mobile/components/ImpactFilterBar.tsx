import { useEffect, useState } from "react";
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
  MeritIndexOrder,
  MeritIndexSort,
  MeritSourceCategory,
  NaceNode,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchNaceTree } from "@/lib/api";
import { t } from "@/lib/i18n";

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
  signedIn: boolean;
};

const SOURCE_OPTIONS: Array<{
  id: MeritSourceCategory | null;
  labelKey: string;
  color?: string;
}> = [
  { id: null, labelKey: "impact.source_all" },
  { id: "taxes", labelKey: "community.cat_taxes", color: colors.catTaxes },
  { id: "charity", labelKey: "community.cat_charity", color: colors.catCharity },
  {
    id: "volunteer",
    labelKey: "community.cat_volunteer",
    color: colors.catVolunteer,
  },
];

const COUNTRY_OPTIONS: Array<{
  iso2: string | null;
  labelKey: string;
}> = [
  { iso2: null, labelKey: "impact.country_all" },
  { iso2: "SK", labelKey: "impact.country_sk" },
];

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        active && color ? { borderColor: color } : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          active && color ? { color } : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ImpactFilterBar({ filters, onChange, signedIn }: Props) {
  const [naceTree, setNaceTree] = useState<NaceNode[]>([]);
  const [naceLoading, setNaceLoading] = useState(false);
  const [naceOpen, setNaceOpen] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
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
  }, [signedIn]);

  function patch(partial: Partial<ImpactFilters>) {
    onChange({ ...filters, ...partial });
  }

  const naceLabel =
    filters.nace_section_label ?? t("impact.filter_nace_any");

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>{t("impact.filter_country")}</Text>
      <View style={styles.chipRow}>
        {COUNTRY_OPTIONS.map((opt) => {
          const active =
            (opt.iso2 ?? undefined) === (filters.country_iso2 ?? undefined);
          return (
            <Chip
              key={opt.labelKey}
              label={t(opt.labelKey)}
              active={active}
              onPress={() =>
                patch({
                  country_iso2: opt.iso2 ?? undefined,
                  country_label: opt.iso2 ? t(opt.labelKey) : undefined,
                })
              }
            />
          );
        })}
      </View>

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

      <Text style={styles.sectionLabel}>{t("impact.filter_nace")}</Text>
      <Pressable
        style={styles.nacePicker}
        onPress={() => setNaceOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.nacePickerText} numberOfLines={1}>
          {naceLabel}
        </Text>
        <MaterialIcons name="expand-more" size={22} color={colors.muted} />
      </Pressable>

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
              {naceTree.map((node) => {
                const tid = Number(node.tid);
                const active = filters.nace_section_tid === tid;
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
                      {node.label}
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
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
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
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.brandSoft },
  nacePicker: {
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
  nacePickerText: {
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
