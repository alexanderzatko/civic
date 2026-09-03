import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import {
  DEFAULT_SETTINGS,
  displayMerits,
  type MeritRate,
  type RankDistribution,
  type UserLookup,
} from "@civic/shared";
import { ContributionBreakdown } from "@/components/ContributionBreakdown";
import { MeLogo } from "@/components/MeLogo";
import { RankPanel } from "@/components/RankPanel";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import {
  fetchCommunitySummary,
  fetchMeritRate,
  fetchMySummary,
  fetchRankDistribution,
  lookupUser,
} from "@/lib/api";
import { useMeritsAutoRefresh } from "@/lib/useMeritsAutoRefresh";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

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

export default function HomeScreen() {
  const { status } = useAuth();
  const { locale } = useLocale();
  const signedIn = status === "signedIn";
  const [loading, setLoading] = useState(true);
  const [communityMe, setCommunityMe] = useState(0);
  const [personalMe, setPersonalMe] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [rank, setRank] = useState<RankDistribution | null>(null);
  const [meritRate, setMeritRate] = useState<MeritRate | null>(null);
  const [profile, setProfile] = useState<UserLookup | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);

  const refresh = useCallback(async () => {
    // Avoid treating "auth still restoring" as signed-out — that race left Home
    // stuck on the anonymous fetch until the next focus (e.g. Profile → Home).
    if (status === "loading") return;
    try {
      if (signedIn) {
        const [mine, community, distribution, rate] = await Promise.all([
          fetchMySummary(),
          fetchCommunitySummary(),
          fetchRankDistribution(),
          fetchMeritRate(),
        ]);
        const name = mine.username?.trim() || null;
        setUsername(name ?? mine.display_name ?? null);
        setPersonalMe(mine.total_me);
        setCommunityMe(community.total_me);
        setRank(distribution);
        setMeritRate(rate);

        if (name) {
          try {
            setProfile(await lookupUser(name));
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } else {
        // Mockup logged-out home: community total only (no ladder).
        const [summary, rate] = await Promise.all([
          fetchCommunitySummary(),
          fetchMeritRate(),
        ]);
        setUsername(null);
        setPersonalMe(0);
        setCommunityMe(summary.total_me);
        setRank(null);
        setMeritRate(rate);
        setProfile(null);
      }
    } catch {
      // API may be down — keep last good values.
    } finally {
      setLoading(false);
    }
  }, [signedIn, status, locale]);

  useMeritsAutoRefresh(() => {
    if (status !== "loading") {
      void refresh();
    }
  });

  // Focus refresh often runs while auth is still "loading" (signedIn=false).
  // Re-fetch once the session is known.
  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }
    void refresh();
  }, [status, refresh]);

  if (status === "loading") {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (signedIn) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={!scrollLocked}
      >
        <Text style={styles.title}>{t("home.title")}</Text>

        <View style={styles.personalBlock}>
          <MeLogo size={56} />
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <Text style={styles.personalMe}>
                {formatMe(personalMe)} {t("common.me")}
              </Text>
              <Text style={styles.eurHint}>
                {formatEurApprox(personalMe, meritRate)}
              </Text>
              {username ? (
                <Text style={styles.uidHint}>
                  @{username}
                  {profile?.member_since_year
                    ? `  ·  ${t("impact.member_since").replace("{{year}}", String(profile.member_since_year))}`
                    : ""}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {!loading && rank ? (
          <RankPanel
            distribution={rank}
            userMe={personalMe}
            onScrollLockChange={setScrollLocked}
          />
        ) : null}

        {!loading && profile ? (
          <ContributionBreakdown profile={profile} emptyTone="self" />
        ) : null}

        <Link href="/(tabs)/earn" asChild>
          <Pressable style={styles.primaryBtnWide}>
            <Text style={styles.primaryText}>{t("home.cta_earn")}</Text>
          </Pressable>
        </Link>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>{t("home.footer_me")}</Text>
          <Text style={styles.footerLine}>{t("home.footer_hours")}</Text>
          <Text style={styles.footerLine}>{t("home.footer_eur")}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t("home.title")}</Text>

      <Text style={styles.intro}>
        <Text style={styles.introBold}>{t("home.intro_brand")}</Text>
        {t("home.intro_mid")}
        <Text style={styles.introBold}>{t("home.intro_me")}</Text>
        {t("home.intro_end")}
      </Text>

      <View style={styles.personalBlock}>
        <MeLogo size={48} />
      </View>

      <View style={styles.communityBlock}>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <>
            <Text style={styles.communityMe}>
              {formatMe(communityMe)} {t("common.me")}
            </Text>
            <Text style={styles.eurHint}>
              {formatEurApprox(communityMe, meritRate)}
            </Text>
          </>
        )}
      </View>

      <Text style={styles.communityLabel}>{t("home.community_total_label")}</Text>
      <Text style={styles.authPrompt}>{t("home.auth_prompt")}</Text>

      <View style={styles.authRow}>
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>{t("home.sign_in")}</Text>
          </Pressable>
        </Link>
        <Link href="/(auth)/register" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>{t("home.register")}</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLine}>{t("home.footer_me")}</Text>
        <Text style={styles.footerLine}>{t("home.footer_hours")}</Text>
        <Text style={styles.footerLine}>{t("home.footer_eur")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    padding: 24,
    gap: 18,
    paddingBottom: 48,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
  },
  introBold: {
    fontWeight: "700",
    color: colors.ink,
  },
  personalBlock: {
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
  },
  personalMe: {
    fontSize: 40,
    fontWeight: "600",
    color: colors.you,
    lineHeight: 44,
  },
  communityBlock: {
    alignItems: "center",
    gap: 4,
  },
  communityLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  communityMe: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 28,
  },
  eurHint: {
    fontSize: 13,
    color: colors.muted,
  },
  uidHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  loader: { marginVertical: 8 },
  authPrompt: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  authRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryBtnWide: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    minWidth: 200,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.brandSoft, fontWeight: "600", fontSize: 15 },
  footer: {
    marginTop: 8,
    alignItems: "center",
    gap: 4,
  },
  footerLine: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
});
