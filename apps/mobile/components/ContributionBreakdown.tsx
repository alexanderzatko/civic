import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { UserLookup } from "@civic/shared";
import {
  MeritMixBar,
  type MeritSourceId,
} from "@/components/MeritMixBar";
import { ProjectMeTable } from "@/components/ProjectMeTable";
import { TaxMonthsChart } from "@/components/TaxMonthsChart";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  profile: Pick<
    UserLookup,
    | "total_me"
    | "by_category"
    | "taxes_last_3_months"
    | "top_charities"
    | "top_volunteer_projects"
  >;
  /** `self` = signed-in user's Home; `other` = looked-up Community profile. */
  emptyTone?: "self" | "other";
};

/** Fixed left-to-right tab order; on ties, leftmost wins (strict `>`). */
function topMeritSource(by: {
  taxes: number;
  charity: number;
  volunteer: number;
}): MeritSourceId {
  let best: MeritSourceId = "taxes";
  let bestValue = by.taxes;
  if (by.charity > bestValue) {
    best = "charity";
    bestValue = by.charity;
  }
  if (by.volunteer > bestValue) {
    best = "volunteer";
  }
  return best;
}

export function ContributionBreakdown({
  profile,
  emptyTone = "other",
}: Props) {
  const [activeId, setActiveId] = useState<MeritSourceId>(() =>
    topMeritSource(profile.by_category),
  );

  useEffect(() => {
    setActiveId(topMeritSource(profile.by_category));
  }, [
    profile.by_category.taxes,
    profile.by_category.charity,
    profile.by_category.volunteer,
  ]);

  const taxesNone =
    emptyTone === "self" ? t("home.taxes_none") : t("community.taxes_none");
  const charityNone =
    emptyTone === "self" ? t("home.charity_none") : t("community.charity_none");
  const volunteerNone =
    emptyTone === "self"
      ? t("home.volunteer_none")
      : t("community.volunteer_none");

  return (
    <View style={styles.wrap}>
      <MeritMixBar
        taxes={profile.by_category.taxes}
        charity={profile.by_category.charity}
        volunteer={profile.by_category.volunteer}
        total={profile.total_me}
        activeId={activeId}
        onSelect={setActiveId}
      />

      {activeId === "taxes" && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.catTaxes }]}>
            {t("community.card_taxes")}
          </Text>
          {profile.by_category.taxes > 0 ? (
            <TaxMonthsChart months={profile.taxes_last_3_months} />
          ) : (
            <Text style={styles.cardHint}>{taxesNone}</Text>
          )}
        </View>
      )}

      {activeId === "charity" && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.catCharity }]}>
            {t("community.card_charity")}
          </Text>
          {profile.by_category.charity > 0 ? (
            <>
              <Text style={styles.cardHint}>{t("community.charity_hint")}</Text>
              <ProjectMeTable
                rows={profile.top_charities}
                emptyLabel={t("community.charity_empty")}
              />
            </>
          ) : (
            <Text style={styles.cardHint}>{charityNone}</Text>
          )}
        </View>
      )}

      {activeId === "volunteer" && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.catVolunteer }]}>
            {t("community.card_volunteer")}
          </Text>
          {profile.by_category.volunteer > 0 ? (
            <>
              <Text style={styles.cardHint}>{t("community.volunteer_hint")}</Text>
              <ProjectMeTable
                rows={profile.top_volunteer_projects}
                emptyLabel={t("community.volunteer_empty")}
              />
            </>
          ) : (
            <Text style={styles.cardHint}>{volunteerNone}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignSelf: "stretch", gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardHint: { fontSize: 13, color: colors.muted },
});
