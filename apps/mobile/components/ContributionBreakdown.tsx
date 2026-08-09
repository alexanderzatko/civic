import { StyleSheet, Text, View } from "react-native";
import type { UserLookup } from "@civic/shared";
import { MeritMixBar } from "@/components/MeritMixBar";
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

export function ContributionBreakdown({
  profile,
  emptyTone = "other",
}: Props) {
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
      />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.catTaxes }]}>
            {t("community.card_taxes")}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.catTaxes }]}>
            <Text style={styles.pillText}>1</Text>
          </View>
        </View>
        {profile.by_category.taxes > 0 ? (
          <TaxMonthsChart months={profile.taxes_last_3_months} />
        ) : (
          <Text style={styles.cardHint}>{taxesNone}</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.catCharity }]}>
            {t("community.card_charity")}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.catCharity }]}>
            <Text style={styles.pillText}>2</Text>
          </View>
        </View>
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

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.catVolunteer }]}>
            {t("community.card_volunteer")}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.catVolunteer }]}>
            <Text style={styles.pillText}>3</Text>
          </View>
        </View>
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardHint: { fontSize: 13, color: colors.muted },
  pill: {
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
