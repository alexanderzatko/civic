import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  MeritIndexOrder,
  MeritIndexSort,
  MeritSourceCategory,
  NaceExpertiseSection,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export type ImpactFilterColumn =
  | "position"
  | "total_me"
  | "value_eur"
  | "country"
  | "nace"
  | "sources";

export type ImpactFilters = {
  sort: MeritIndexSort;
  order: MeritIndexOrder;
  min_me?: string;
  max_me?: string;
  min_value_eur?: string;
  max_value_eur?: string;
  country_iso2?: string;
  country_label?: string;
  since_from?: string;
  nace_section_tid?: number;
  nace_section_label?: string;
  source_category?: MeritSourceCategory;
};

type Props = {
  visible: boolean;
  column: ImpactFilterColumn | null;
  filters: ImpactFilters;
  naceOptions: NaceExpertiseSection[];
  onChange: (next: ImpactFilters) => void;
  onClose: () => void;
};

function SortButtons({
  order,
  onPick,
}: {
  order: MeritIndexOrder;
  onPick: (order: MeritIndexOrder) => void;
}) {
  return (
    <View style={styles.sortRow}>
      <Pressable
        style={[styles.sortBtn, order === "asc" && styles.sortBtnActive]}
        onPress={() => onPick("asc")}
      >
        <Text
          style={[styles.sortBtnText, order === "asc" && styles.sortBtnTextActive]}
        >
          {t("impact.sort_asc")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.sortBtn, order === "desc" && styles.sortBtnActive]}
        onPress={() => onPick("desc")}
      >
        <Text
          style={[styles.sortBtnText, order === "desc" && styles.sortBtnTextActive]}
        >
          {t("impact.sort_desc")}
        </Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

export function ColumnFilterSheet({
  visible,
  column,
  filters,
  naceOptions,
  onChange,
  onClose,
}: Props) {
  if (!column) return null;

  const titleKey = `impact.col_${column}` as const;
  const title = t(titleKey);

  function patch(partial: Partial<ImpactFilters>) {
    onChange({ ...filters, ...partial });
  }

  function sortForCol(): MeritIndexSort {
    switch (column) {
      case "position":
        return "position";
      case "total_me":
        return "total_me";
      case "value_eur":
        return "value_eur";
      case "country":
        return "country";
      case "nace":
        return "total_me";
      case "sources":
        return "taxes_me";
      default:
        return "total_me";
    }
  }

  function applySort(order: MeritIndexOrder) {
    const sort =
      column === "sources" && filters.source_category
        ? (`${filters.source_category}_me` as MeritIndexSort)
        : sortForCol();
    patch({ sort, order });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={styles.sectionLabel}>{t("impact.sort_label")}</Text>
          <SortButtons order={filters.order} onPick={applySort} />

          {column === "position" ? (
            <Field
              label={t("impact.filter_since_from")}
              value={filters.since_from ?? ""}
              onChangeText={(v) => patch({ since_from: v })}
              placeholder="2020-01-01"
              keyboardType="numbers-and-punctuation"
            />
          ) : null}

          {column === "total_me" ? (
            <>
              <Field
                label={t("impact.filter_min_me")}
                value={filters.min_me ?? ""}
                onChangeText={(v) => patch({ min_me: v })}
                keyboardType="numeric"
              />
              <Field
                label={t("impact.filter_max_me")}
                value={filters.max_me ?? ""}
                onChangeText={(v) => patch({ max_me: v })}
                keyboardType="numeric"
              />
            </>
          ) : null}

          {column === "value_eur" ? (
            <>
              <Field
                label={t("impact.filter_min_eur")}
                value={filters.min_value_eur ?? ""}
                onChangeText={(v) => patch({ min_value_eur: v })}
                keyboardType="numeric"
              />
              <Field
                label={t("impact.filter_max_eur")}
                value={filters.max_value_eur ?? ""}
                onChangeText={(v) => patch({ max_value_eur: v })}
                keyboardType="numeric"
              />
            </>
          ) : null}

          {column === "country" ? (
            <Field
              label={t("impact.filter_country_iso")}
              value={filters.country_iso2 ?? ""}
              onChangeText={(v) =>
                patch({
                  country_iso2: v.toUpperCase(),
                  country_label: undefined,
                })
              }
              placeholder="SK"
              keyboardType="default"
            />
          ) : null}

          {column === "nace" ? (
            <>
              <Text style={styles.sectionLabel}>{t("impact.filter_nace_pick")}</Text>
              {naceOptions.length === 0 ? (
                <Text style={styles.hint}>{t("impact.filter_nace_empty")}</Text>
              ) : (
                naceOptions.map((section) => {
                  const active = filters.nace_section_tid === section.section_tid;
                  return (
                    <Pressable
                      key={section.section_tid}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() =>
                        patch({
                          nace_section_tid: active
                            ? undefined
                            : section.section_tid,
                          nace_section_label: active
                            ? undefined
                            : section.section_label,
                        })
                      }
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {section.section_label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </>
          ) : null}

          {column === "sources" ? (
            <>
              <Text style={styles.sectionLabel}>{t("impact.filter_source_pick")}</Text>
              {(["taxes", "charity", "volunteer"] as MeritSourceCategory[]).map(
                (cat) => {
                  const active = filters.source_category === cat;
                  const labelKey =
                    cat === "taxes"
                      ? "community.cat_taxes"
                      : cat === "charity"
                        ? "community.cat_charity"
                        : "community.cat_volunteer";
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() =>
                        patch({
                          source_category: active ? undefined : cat,
                          sort: active ? filters.sort : (`${cat}_me` as MeritIndexSort),
                        })
                      }
                    >
                      <Text
                        style={[styles.optionText, active && styles.optionTextActive]}
                      >
                        {t(labelKey)}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </>
          ) : null}

          <Pressable style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyBtnText}>{t("impact.filter_apply")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    maxHeight: "72%",
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
  sheetBody: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 4,
  },
  sortRow: { flexDirection: "row", gap: 8 },
  sortBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  sortBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  sortBtnText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  sortBtnTextActive: { color: "#fff" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
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
  applyBtn: {
    marginTop: 8,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
