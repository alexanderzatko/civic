import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  DEFAULT_SETTINGS,
  displayMerits,
  type MeritRate,
  type RankDistribution,
  type UserLookup,
} from "@civic/shared";
import { MeLogo } from "@/components/MeLogo";
import { MeritMixBar } from "@/components/MeritMixBar";
import { ProjectMeTable } from "@/components/ProjectMeTable";
import { RankPanel } from "@/components/RankPanel";
import { TaxMonthsChart } from "@/components/TaxMonthsChart";
import { colors } from "@/constants/theme";
import {
  fetchMeritRate,
  fetchRankDistribution,
  lookupUser,
} from "@/lib/api";
import { rememberRecentProfile } from "@/lib/profile-recents";
import { t } from "@/lib/i18n";

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function meritsToEur(me: number, rate: MeritRate | null): number {
  const hourly = rate?.hourly_wage_eur ?? DEFAULT_SETTINGS.hourlyWageEur;
  const perHour = rate?.merits_per_hour ?? DEFAULT_SETTINGS.meritsPerHour;
  return (me / perHour) * hourly;
}

function formatEurApprox(me: number, rate: MeritRate | null): string {
  return `~ ${Math.round(meritsToEur(me, rate)).toLocaleString("sk-SK")} ${t("common.eur")}`;
}

export default function CommunityProfileScreen() {
  const params = useLocalSearchParams<{ username: string }>();
  const usernameParam = Array.isArray(params.username)
    ? params.username[0]
    : params.username;
  const username = usernameParam ? decodeURIComponent(usernameParam) : "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<UserLookup | null>(null);
  const [rank, setRank] = useState<RankDistribution | null>(null);
  const [meritRate, setMeritRate] = useState<MeritRate | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setNotFound(false);
      void (async () => {
        try {
          const [lookedUp, distribution, rate] = await Promise.all([
            lookupUser(username),
            fetchRankDistribution(),
            fetchMeritRate(),
          ]);
          if (cancelled) return;
          setProfile(lookedUp);
          setRank(distribution);
          setMeritRate(rate);
          await rememberRecentProfile({
            username: lookedUp.username,
            display_name: lookedUp.display_name,
            total_me: lookedUp.total_me,
          });
        } catch (err) {
          if (cancelled) return;
          const status = (err as { status?: number })?.status;
          setProfile(null);
          setNotFound(status === 404);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [username]),
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>{t("community.not_found_title")}</Text>
        <Text style={styles.hint}>
          {t("community.not_found")}
          {username ? ` (@${username})` : ""}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      scrollEnabled={!scrollLocked}
    >
      <View style={styles.hero}>
        <MeLogo size={48} />
        <Text style={styles.handle}>
          @{profile.username} · {profile.display_name}
        </Text>
        <Text style={styles.meTotal}>
          {formatMe(profile.total_me)} {t("common.me")}
        </Text>
        <Text style={styles.eur}>{formatEurApprox(profile.total_me, meritRate)}</Text>
      </View>

      {rank ? (
        <RankPanel
          distribution={rank}
          userMe={profile.total_me}
          variant="other"
          linkCommunity={false}
          onScrollLockChange={setScrollLocked}
        />
      ) : null}

      <MeritMixBar
        taxes={profile.by_category.taxes}
        charity={profile.by_category.charity}
        volunteer={profile.by_category.volunteer}
        total={profile.total_me}
      />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("community.card_taxes")}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>1</Text>
          </View>
        </View>
        <TaxMonthsChart months={profile.taxes_last_3_months} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("community.card_charity")}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>2</Text>
          </View>
        </View>
        <Text style={styles.cardHint}>{t("community.charity_hint")}</Text>
        <ProjectMeTable
          rows={profile.top_charities}
          emptyLabel={t("community.charity_empty")}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("community.card_volunteer")}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>3</Text>
          </View>
        </View>
        <Text style={styles.cardHint}>{t("community.volunteer_hint")}</Text>
        <ProjectMeTable
          rows={profile.top_volunteer_projects}
          emptyLabel={t("community.volunteer_empty")}
        />
      </View>

      <View style={styles.footerSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
    alignItems: "stretch",
  },
  hero: { alignItems: "center", gap: 6 },
  handle: { fontSize: 13, color: colors.muted },
  meTotal: {
    fontSize: 36,
    fontWeight: "600",
    color: colors.brand,
  },
  eur: { fontSize: 14, color: colors.muted },
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
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  cardHint: { fontSize: 13, color: colors.muted },
  pill: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  footerSpacer: { height: 8 },
});
