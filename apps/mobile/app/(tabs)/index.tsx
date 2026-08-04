import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { displayMerits, type RankDistribution } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchCommunitySummary, fetchRankDistribution } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [communityMe, setCommunityMe] = useState(0);
  const [rank, setRank] = useState<RankDistribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summary, distribution] = await Promise.all([
          fetchCommunitySummary(),
          fetchRankDistribution(),
        ]);
        if (cancelled) return;
        setCommunityMe(summary.total_me);
        setRank(distribution);
      } catch {
        // Phase 1: API may be down — show empty shell.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = Math.max(1, ...(rank?.buckets.map((b) => b.count) ?? [1]));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand}>Civic</Text>
      <Text style={styles.title}>{t("home.title")}</Text>
      <Text style={styles.subtitle}>{t("home.subtitle_logged_out")}</Text>

      <View style={styles.heroBlock}>
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <Text style={styles.heroValue}>
              {displayMerits(communityMe)} {t("common.me")}
            </Text>
            <Text style={styles.heroHint}>{t("home.placeholder_total")}</Text>
          </>
        )}
      </View>

      <Text style={styles.section}>{t("home.rank_title")}</Text>
      <View style={styles.chart}>
        {(rank?.buckets ?? []).map((bucket) => (
          <View key={bucket.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{bucket.label}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(bucket.count / maxCount) * 100}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <Link href="/(tabs)/community" asChild>
        <Pressable>
          <Text style={styles.link}>{t("home.community_position")} →</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)/earn" asChild>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>{t("home.cta_earn")}</Text>
        </Pressable>
      </Link>

      <View style={styles.authRow}>
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>{t("home.sign_in")}</Text>
          </Pressable>
        </Link>
        <Link href="/(auth)/register" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>{t("home.register")}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, paddingBottom: 48 },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brand,
    letterSpacing: 0.5,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 8 },
  heroBlock: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    padding: 24,
    minHeight: 110,
    justifyContent: "center",
  },
  heroValue: { color: "#fff", fontSize: 36, fontWeight: "700" },
  heroHint: { color: "#C9D9D1", marginTop: 6, fontSize: 13 },
  section: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  chart: { gap: 8, marginTop: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 64, fontSize: 12, color: colors.muted },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.brandSoft },
  link: { color: colors.brandSoft, fontWeight: "600", marginTop: 4 },
  cta: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  authRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontWeight: "600" },
});
