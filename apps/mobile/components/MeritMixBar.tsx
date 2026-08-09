import { Pressable, StyleSheet, Text, View } from "react-native";
import { displayMerits } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export type MeritSourceId = "taxes" | "charity" | "volunteer";

const TAB_ACTIVE_BG: Record<MeritSourceId, string> = {
  taxes: "rgba(59, 110, 165, 0.08)",
  charity: "rgba(27, 107, 74, 0.08)",
  volunteer: "rgba(196, 122, 44, 0.08)",
};

type Props = {
  taxes: number;
  charity: number;
  volunteer: number;
  total: number;
  activeId: MeritSourceId;
  onSelect: (id: MeritSourceId) => void;
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

export function MeritMixBar({
  taxes,
  charity,
  volunteer,
  total,
  activeId,
  onSelect,
}: Props) {
  const sum = Math.max(total, taxes + charity + volunteer, 0.0001);
  const segments: {
    id: MeritSourceId;
    value: number;
    color: string;
    label: string;
  }[] = [
    {
      id: "taxes",
      value: taxes,
      color: colors.catTaxes,
      label: t("community.cat_taxes"),
    },
    {
      id: "charity",
      value: charity,
      color: colors.catCharity,
      label: t("community.cat_charity"),
    },
    {
      id: "volunteer",
      value: volunteer,
      color: colors.catVolunteer,
      label: t("community.cat_volunteer"),
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{t("community.mix_title")}</Text>
        <Text style={styles.headerValue}>
          {formatMe(total)} {t("common.me")}
        </Text>
      </View>
      <View style={styles.bar}>
        {segments.map((s) => {
          const pct = Math.max(0, (s.value / sum) * 100);
          if (pct <= 0) return null;
          return (
            <View
              key={s.id}
              style={[styles.seg, { width: `${pct}%`, backgroundColor: s.color }]}
            />
          );
        })}
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {segments.map((s) => {
          const active = s.id === activeId;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(s.id)}
              style={[
                styles.tab,
                active && {
                  borderColor: s.color,
                  backgroundColor: TAB_ACTIVE_BG[s.id],
                },
              ]}
            >
              <Text style={[styles.tabValue, active && { color: s.color }]}>
                {formatMe(s.value)}
              </Text>
              <Text style={[styles.tabLabel, { color: s.color }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLabel: { fontSize: 14, fontWeight: "600", color: colors.ink },
  headerValue: { fontSize: 13, color: colors.muted },
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  seg: { height: "100%" },
  tabs: { flexDirection: "row", gap: 10 },
  tab: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  tabValue: { fontSize: 15, fontWeight: "600", color: colors.ink },
  tabLabel: { fontSize: 12, fontWeight: "600" },
});
