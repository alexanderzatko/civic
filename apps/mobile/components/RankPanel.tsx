import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  bucketIndexForMe,
  medianBucketIndex,
  percentileFromDistribution,
  spelledBucketLabel,
  type RankDistribution,
} from "@civic/shared";
import { router } from "expo-router";
import { colors } from "@/constants/theme";
import { getLocale, t } from "@/lib/i18n";

type Props = {
  distribution: RankDistribution;
  /** When set, used for percentile instead of distribution.user_merits. */
  userMe?: number;
  /**
   * `self` (default): 2nd-person headline with community deep-links.
   * `other`: 3rd-person headline for a looked-up public profile (same bands).
   */
  variant?: "self" | "other";
  /** When false, community words in the headline are not tappable. */
  linkCommunity?: boolean;
};

type RankBand =
  | "start"
  | "lower_quarter"
  | "lower_half"
  | "mid"
  | "above"
  | "top";

function rankBand(percentile: number): RankBand {
  const p = percentile / 100;
  if (p < 0.25) return "start";
  if (p < 1 / 3) return "lower_quarter";
  if (p < 0.5) return "lower_half";
  if (p < 2 / 3) return "mid";
  if (p < 0.75) return "above";
  return "top";
}

function headlineKey(
  percentile: number,
  variant: "self" | "other",
): string {
  const band = rankBand(percentile);
  return variant === "other"
    ? `community.rank_${band}`
    : `home.rank_${band}`;
}

const LINK_WORDS = new Set([
  "komunite",
  "komunity",
  "prispievateľov",
  "prispievateľom",
  "community",
  "contributors",
  "contributor",
]);

/** 2nd-person markers in the rank caption ("ste" / "you"). */
const YOU_WORDS = new Set(["ste", "you"]);

function HeadlineWithLinks({
  text,
  linkCommunity = true,
}: {
  text: string;
  linkCommunity?: boolean;
}) {
  const parts = text.split(/(\s+)/);
  return (
    <Text style={styles.headline}>
      {parts.map((part, i) => {
        const bare = part.replace(/[.,!?]$/, "");
        if (LINK_WORDS.has(bare.toLowerCase())) {
          const punct = part.slice(bare.length);
          if (!linkCommunity) {
            return (
              <Text key={i} style={styles.linkPlain}>
                {bare}
                {punct}
              </Text>
            );
          }
          return (
            <Text
              key={i}
              style={styles.link}
              onPress={() => router.push("/(tabs)/community")}
            >
              {bare}
              {punct}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function CaptionWithYouHighlight({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <Text style={styles.caption}>
      {parts.map((part, i) => {
        const bare = part.replace(/[.,!?]$/, "");
        if (YOU_WORDS.has(bare.toLowerCase())) {
          const punct = part.slice(bare.length);
          return (
            <Text key={i} style={styles.youWord}>
              {bare}
              {punct}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const CHART_HEIGHT = 110;

function RankDistributionDetail({
  distribution,
  highlightIndex = -1,
  userBucketIndex = -1,
  onBarPress,
  emphasizeBucketLabel = false,
}: {
  distribution: RankDistribution;
  /** Bucket to emphasize; `-1` leaves all bars unaccented. */
  highlightIndex?: number;
  /** When the highlighted bar is the signed-in user's band, use the "you" accent. */
  userBucketIndex?: number;
  /** When set, bars are tappable (guest chart / exploratory probe). */
  onBarPress?: (index: number) => void;
  /** Guest chart: interval label matches the people-count weight. */
  emphasizeBucketLabel?: boolean;
}) {
  const maxCount = Math.max(...distribution.buckets.map((b) => b.count), 1);
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";
  const bucketLabel =
    highlightIndex >= 0
      ? spelledBucketLabel(distribution, highlightIndex, locale)
      : null;
  const reserveBucketSlot = Boolean(onBarPress) || emphasizeBucketLabel;

  return (
    <View style={styles.detail}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {distribution.buckets.map((b, i) => {
          const h =
            b.count > 0
              ? Math.max((b.count / maxCount) * CHART_HEIGHT, 3)
              : 0;
          const isHighlight = i === highlightIndex;
          const isYours = i === userBucketIndex;
          const bar = (
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: isHighlight
                    ? isYours
                      ? colors.you
                      : colors.brand
                    : isYours
                      ? colors.youSoft
                      : colors.border,
                  opacity:
                    highlightIndex >= 0 && !isHighlight && !isYours ? 0.45 : 1,
                },
              ]}
            />
          );
          return (
            <View key={`${b.label}-${i}`} style={styles.barCol}>
              {onBarPress ? (
                <Pressable
                  style={styles.barHit}
                  onPress={() => onBarPress(i)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    spelledBucketLabel(distribution, i, locale) ?? b.label
                  }
                  accessibilityState={{ selected: isHighlight }}
                >
                  {bar}
                </Pressable>
              ) : (
                bar
              )}
            </View>
          );
        })}
      </View>
      {bucketLabel || reserveBucketSlot ? (
        <Text
          style={[
            emphasizeBucketLabel ? styles.bucketLabelEmph : styles.bucketHint,
            !bucketLabel ? styles.bucketLabelHidden : null,
          ]}
        >
          {bucketLabel ?? " "}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Always-visible Merit histogram (no ladder). Used on the anonymous Home
 * screen — starts with a median-band example highlight so guests see what a
 * tap reveals; tap any bar to explore.
 */
export function RankDistributionChart({
  distribution,
  caption,
}: {
  distribution: RankDistribution;
  caption?: string;
}) {
  const [highlightIndex, setHighlightIndex] = useState(() =>
    medianBucketIndex(distribution),
  );
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";

  useEffect(() => {
    setHighlightIndex(medianBucketIndex(distribution));
  }, [distribution]);

  const onBarPress = useCallback((index: number) => {
    setHighlightIndex(index);
  }, []);

  const probeCount =
    highlightIndex >= 0
      ? (distribution.buckets[highlightIndex]?.count ?? 0)
      : null;

  return (
    <View style={styles.card}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {probeCount != null ? (
        <Text style={styles.probeHint}>
          {t("home.rank_probe_prefix")}{" "}
          <Text style={styles.probeCount}>
            {probeCount.toLocaleString(locale)}
          </Text>
        </Text>
      ) : (
        <Text style={[styles.probeHint, styles.probeHintHidden]}> </Text>
      )}
      <RankDistributionDetail
        distribution={distribution}
        highlightIndex={highlightIndex}
        onBarPress={onBarPress}
        emphasizeBucketLabel
      />
      <Text style={styles.tapHint}>{t("home.rank_guest_tap_hint")}</Text>
    </View>
  );
}

export function RankPanel({
  distribution,
  userMe,
  variant = "self",
  linkCommunity = true,
}: Props) {
  const me =
    typeof userMe === "number" ? userMe : distribution.user_merits;
  // People-weighted: drives the headline ("top half", etc.).
  const percentile =
    typeof me === "number"
      ? percentileFromDistribution(distribution, me)
      : null;

  const userBucketIndex =
    typeof me === "number" ? bucketIndexForMe(distribution, me) : -1;

  const [highlightIndex, setHighlightIndex] = useState(userBucketIndex);

  useEffect(() => {
    setHighlightIndex(userBucketIndex);
  }, [userBucketIndex, distribution]);

  const onBarPress = useCallback((index: number) => {
    setHighlightIndex(index);
  }, []);

  if (percentile === null || userBucketIndex < 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>
          {variant === "other"
            ? t("community.rank_unavailable")
            : t("home.rank_anonymous")}
        </Text>
      </View>
    );
  }

  const highlightCount =
    highlightIndex >= 0
      ? (distribution.buckets[highlightIndex]?.count ?? 0)
      : 0;
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";

  return (
    <View style={styles.card}>
      <HeadlineWithLinks
        text={t(headlineKey(percentile, variant))}
        linkCommunity={linkCommunity}
      />
      {variant === "self" ? (
        <CaptionWithYouHighlight text={t("home.rank_caption")} />
      ) : null}

      <Text style={styles.probeHint}>
        {t("home.rank_probe_prefix")}{" "}
        <Text style={styles.probeCount}>
          {highlightCount.toLocaleString(locale)}
        </Text>
      </Text>
      <RankDistributionDetail
        distribution={distribution}
        highlightIndex={highlightIndex}
        userBucketIndex={userBucketIndex}
        onBarPress={onBarPress}
        emphasizeBucketLabel
      />
      <Text style={styles.tapHint}>{t("home.rank_guest_tap_hint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    overflow: "visible",
  },
  headline: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 22,
  },
  link: {
    color: colors.brandSoft,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  linkPlain: {
    color: colors.brandSoft,
    fontWeight: "600",
  },
  caption: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  youWord: {
    color: colors.you,
    fontWeight: "700",
  },
  probeHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    minHeight: 26,
  },
  probeCount: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.brand,
  },
  probeHintHidden: {
    opacity: 0,
  },
  detail: {
    gap: 8,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  barCol: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barHit: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 2,
  },
  bucketHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    minHeight: 16,
  },
  bucketLabelEmph: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    minHeight: 26,
  },
  bucketLabelHidden: {
    opacity: 0,
  },
  tapHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
});
