import { StyleSheet, Text, View } from "react-native";
import { displayMerits } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  taxes: number;
  charity: number;
  volunteer: number;
  total: number;
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

export function MeritMixBar({ taxes, charity, volunteer, total }: Props) {
  const sum = Math.max(total, taxes + charity + volunteer, 0.0001);
  const segments = [
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
      <View style={styles.stats}>
        {segments.map((s) => (
          <View key={s.id} style={styles.stat}>
            <Text style={styles.statValue}>{formatMe(s.value)}</Text>
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
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
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 15, fontWeight: "600", color: colors.ink },
  statLabel: { fontSize: 12, fontWeight: "600" },
});
