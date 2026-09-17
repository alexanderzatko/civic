import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { displayMerits, type UserLookup } from "@civic/shared";
import { ProjectMeTable } from "@/components/ProjectMeTable";
import { NaceExpertiseIcons } from "@/components/NaceExpertiseIcons";
import { TaxMonthsTable } from "@/components/TaxMonthsTable";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type MeritSourceId = "taxes" | "charity" | "volunteer";

type Props = {
  profile: Pick<
    UserLookup,
    | "by_category"
    | "taxes_last_3_months"
    | "top_charities"
    | "top_volunteer_projects"
    | "nace_expertise"
  >;
  /** `self` = signed-in user's Home; `other` = looked-up Community profile. */
  emptyTone?: "self" | "other";
};

const SOURCE_META: {
  id: MeritSourceId;
  color: string;
  catKey: string;
  cardKey: string;
}[] = [
  {
    id: "taxes",
    color: colors.catTaxes,
    catKey: "community.cat_taxes",
    cardKey: "community.card_taxes",
  },
  {
    id: "charity",
    color: colors.catCharity,
    catKey: "community.cat_charity",
    cardKey: "community.card_charity",
  },
  {
    id: "volunteer",
    color: colors.catVolunteer,
    catKey: "community.cat_volunteer",
    cardKey: "community.card_volunteer",
  },
];

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

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

  const activeMeta = SOURCE_META.find((s) => s.id === activeId)!;
  const valueFor = (id: MeritSourceId) => profile.by_category[id];
  const isFirst = activeId === "taxes";
  const isLast = activeId === "volunteer";

  return (
    <View style={styles.wrap}>
      <Text style={styles.headerTitle}>{t("community.mix_title")}</Text>

      <View style={styles.cabinet}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {SOURCE_META.map((s) => {
            const active = s.id === activeId;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveId(s.id)}
                style={[
                  styles.tab,
                  active ? styles.tabActive : styles.tabInactive,
                  active && { borderColor: s.color },
                ]}
              >
                <Text
                  style={[styles.tabLabel, { color: s.color }]}
                  numberOfLines={1}
                >
                  {t(s.catKey)}
                </Text>
                <Text style={[styles.tabValue, active && { color: s.color }]}>
                  {formatMe(valueFor(s.id))} {t("common.me")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.drawer,
            { borderColor: activeMeta.color },
            // Flush with the active outer tab so the side edge is one line.
            isFirst && styles.drawerFlushLeft,
            isLast && styles.drawerFlushRight,
          ]}
        >
          <Text style={[styles.drawerTitle, { color: activeMeta.color }]}>
            {t(activeMeta.cardKey)}
          </Text>

          {activeId === "taxes" &&
            (valueFor("taxes") > 0 ? (
              <>
                <Text style={styles.drawerHint}>
                  {t("community.taxes_hint")}
                </Text>
                <TaxMonthsTable
                  months={profile.taxes_last_3_months}
                  emptyLabel={t("community.taxes_empty")}
                />
              </>
            ) : (
              <Text style={styles.drawerHint}>{taxesNone}</Text>
            ))}

          {activeId === "charity" &&
            (valueFor("charity") > 0 ? (
              <>
                <Text style={styles.drawerHint}>
                  {t("community.charity_hint")}
                </Text>
                <ProjectMeTable
                  rows={profile.top_charities}
                  emptyLabel={t("community.charity_empty")}
                />
              </>
            ) : (
              <Text style={styles.drawerHint}>{charityNone}</Text>
            ))}

          {activeId === "volunteer" &&
            (valueFor("volunteer") > 0 ||
            profile.top_volunteer_projects.length > 0 ||
            profile.nace_expertise.length > 0 ? (
              <>
                <Text style={styles.drawerHint}>
                  {t("community.volunteer_hint")}
                </Text>
                <ProjectMeTable
                  rows={profile.top_volunteer_projects}
                  emptyLabel={t("community.volunteer_empty")}
                />
                <NaceExpertiseIcons
                  sections={profile.nace_expertise}
                  title={t("community.expertise_title")}
                />
              </>
            ) : valueFor("volunteer") < 0 ? (
              <Text style={styles.drawerHint}>
                {t("community.volunteer_penalty_hint")}
              </Text>
            ) : (
              <Text style={styles.drawerHint}>{volunteerNone}</Text>
            ))}
        </View>
      </View>
    </View>
  );
}

const TAB_RADIUS = 10;
const BORDER = 1.5;

const styles = StyleSheet.create({
  wrap: { width: "100%", alignSelf: "stretch", gap: 10 },
  headerTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  cabinet: {
    width: "100%",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 4,
    borderWidth: BORDER,
    borderBottomWidth: 0,
    borderTopLeftRadius: TAB_RADIUS,
    borderTopRightRadius: TAB_RADIUS,
  },
  tabActive: {
    backgroundColor: colors.surface,
    // Cover the drawer’s top border under this tab.
    marginBottom: -BORDER,
    paddingBottom: 12 + BORDER,
    zIndex: 2,
  },
  tabInactive: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    opacity: 0.85,
  },
  tabLabel: { fontSize: 12, fontWeight: "600" },
  tabValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  drawer: {
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderRadius: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 14,
    gap: 10,
    zIndex: 0,
  },
  drawerFlushLeft: {
    borderTopLeftRadius: 0,
  },
  drawerFlushRight: {
    borderTopRightRadius: 0,
  },
  drawerTitle: { fontSize: 16, fontWeight: "600" },
  drawerHint: { fontSize: 13, color: colors.muted },
});
