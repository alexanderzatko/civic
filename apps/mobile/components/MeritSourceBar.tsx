import { StyleSheet, View } from "react-native";
import type { ContributionCategoryBreakdown } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  by: ContributionCategoryBreakdown;
  height?: number;
};

const SEGMENTS: Array<{
  key: keyof ContributionCategoryBreakdown;
  color: string;
  labelKey: string;
}> = [
  { key: "taxes", color: colors.catTaxes, labelKey: "community.cat_taxes" },
  { key: "charity", color: colors.catCharity, labelKey: "community.cat_charity" },
  {
    key: "volunteer",
    color: colors.catVolunteer,
    labelKey: "community.cat_volunteer",
  },
];

export function MeritSourceBar({ by, height = 10 }: Props) {
  const total = by.taxes + by.charity + by.volunteer;
  const pct = (n: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const accessibilityLabel = SEGMENTS.map(
    (s) => `${t(s.labelKey)} ${pct(by[s.key])}%`,
  ).join(", ");

  if (total <= 0) {
    return (
      <View
        style={[styles.track, { height }]}
        accessibilityLabel={t("impact.sources_empty")}
      />
    );
  }

  return (
    <View
      style={[styles.track, { height }]}
      accessibilityLabel={accessibilityLabel}
    >
      {SEGMENTS.map((seg) => {
        const share = by[seg.key] / total;
        if (share <= 0) return null;
        return (
          <View
            key={seg.key}
            style={{
              flex: share,
              backgroundColor: seg.color,
              height,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#E8EDEA",
    minWidth: 56,
  },
});
