import { StyleSheet, View } from "react-native";
import type { ContributionCategoryBreakdown, MeSourcesDetail } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  by: ContributionCategoryBreakdown;
  /** When aggregate, render Taxes+Gifts as one segment. */
  detail?: MeSourcesDetail;
  height?: number;
};

const DETAILED_SEGMENTS: Array<{
  key: "taxes" | "charity" | "volunteer";
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

export function MeritSourceBar({
  by,
  detail = "detailed",
  height = 10,
}: Props) {
  if (detail === "aggregate") {
    const taxesAndGifts = Math.max(0, Number(by.taxes_and_gifts) || 0);
    const volunteer = Math.max(0, by.volunteer);
    const total = taxesAndGifts + volunteer;
    const segments = [
      {
        key: "taxes_and_gifts",
        value: taxesAndGifts,
        color: colors.catTaxesGifts,
        labelKey: "community.cat_taxes_gifts",
      },
      {
        key: "volunteer",
        value: volunteer,
        color: colors.catVolunteer,
        labelKey: "community.cat_volunteer",
      },
    ] as const;

    const pct = (n: number) =>
      total > 0 ? Math.round((n / total) * 100) : 0;
    const accessibilityLabel = segments
      .map((s) => `${t(s.labelKey)} ${pct(s.value)}%`)
      .join(", ");

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
        {segments.map((seg) => {
          const share = seg.value / total;
          if (share <= 0) return null;
          return (
            <View
              key={seg.key}
              style={{
                flex: share,
                backgroundColor: seg.color,
                height: "100%",
              }}
            />
          );
        })}
      </View>
    );
  }

  // Penalties can make any bucket negative; bar shares use positive parts only.
  const taxes = Math.max(0, by.taxes);
  const charity = Math.max(0, by.charity);
  const volunteer = Math.max(0, by.volunteer);
  const total = taxes + charity + volunteer;
  const values = { taxes, charity, volunteer };
  const pct = (n: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const accessibilityLabel = DETAILED_SEGMENTS.map(
    (s) => `${t(s.labelKey)} ${pct(values[s.key])}%`,
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
      {DETAILED_SEGMENTS.map((seg) => {
        const share = values[seg.key] / total;
        if (share <= 0) return null;
        return (
          <View
            key={seg.key}
            style={{
              flex: share,
              backgroundColor: seg.color,
              height: "100%",
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.border,
  },
});
