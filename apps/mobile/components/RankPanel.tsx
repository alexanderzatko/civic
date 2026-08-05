import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import {
  bucketIndexFromSlider,
  percentileFromDistribution,
  sliderPositionFromMe,
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
  /** Called while the ladder is dragged so the parent can lock scrolling. */
  onScrollLockChange?: (locked: boolean) => void;
};

function headlineKey(percentile: number): string {
  const p = percentile / 100;
  if (p < 0.25) return "home.rank_start";
  if (p < 1 / 3) return "home.rank_lower_quarter";
  if (p < 0.5) return "home.rank_lower_half";
  if (p < 2 / 3) return "home.rank_mid";
  if (p < 0.75) return "home.rank_above";
  return "home.rank_top";
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

function HeadlineWithLinks({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <Text style={styles.headline}>
      {parts.map((part, i) => {
        const bare = part.replace(/[.,!?]$/, "");
        if (LINK_WORDS.has(bare.toLowerCase())) {
          const punct = part.slice(bare.length);
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

const CHART_HEIGHT = 110;
const TRACK_HEIGHT = 8;
const MARKER = 14;

function RankLadder({
  userPercentile,
  onDragStateChange,
}: {
  userPercentile: number;
  onDragStateChange: (state: { dragging: boolean; probePct: number }) => void;
}) {
  const trackRef = useRef<View>(null);
  /** Window-space geometry of the hit target (not locationX — nested markers break that). */
  const trackGeom = useRef({ x: 0, width: 1 });
  const onDragRef = useRef(onDragStateChange);
  const [dragging, setDragging] = useState(false);
  const [probePct, setProbePct] = useState(userPercentile);
  const userPctRef = useRef(userPercentile);
  const draggingRef = useRef(false);

  useEffect(() => {
    onDragRef.current = onDragStateChange;
  }, [onDragStateChange]);

  useEffect(() => {
    userPctRef.current = userPercentile;
    if (!draggingRef.current) setProbePct(userPercentile);
  }, [userPercentile]);

  const measureTrack = (cb?: () => void) => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) trackGeom.current = { x, width };
      cb?.();
    });
  };

  const pctFromPageX = (pageX: number) => {
    const { x, width } = trackGeom.current;
    const w = width > 0 ? width : 1;
    return Math.min(100, Math.max(0, ((pageX - x) / w) * 100));
  };

  const applyProbe = (pageX: number, nextDragging: boolean) => {
    const pct = pctFromPageX(pageX);
    setProbePct(pct);
    onDragRef.current({ dragging: nextDragging, probePct: pct });
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const pageX = e.nativeEvent.pageX;
          draggingRef.current = true;
          setDragging(true);
          // Re-measure in case the scroll view moved since last layout.
          measureTrack(() => applyProbe(pageX, true));
        },
        onPanResponderMove: (_e, gesture) => {
          // gesture.moveX is window X and stays stable while dragging.
          applyProbe(gesture.moveX, true);
        },
        onPanResponderRelease: () => {
          draggingRef.current = false;
          setDragging(false);
          setProbePct(userPctRef.current);
          onDragRef.current({
            dragging: false,
            probePct: userPctRef.current,
          });
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          setDragging(false);
          setProbePct(userPctRef.current);
          onDragRef.current({
            dragging: false,
            probePct: userPctRef.current,
          });
        },
      }),
    [],
  );

  return (
    <View style={styles.ladder}>
      <View
        ref={trackRef}
        style={styles.trackHit}
        onLayout={() => measureTrack()}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={t("home.rank_caption")}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(probePct) }}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.trackFill, { width: `${userPercentile}%` }]} />
          <View
            style={[styles.marker, styles.markerUser, { left: `${userPercentile}%` }]}
          />
          <View
            style={[
              styles.marker,
              styles.markerProbe,
              { left: `${probePct}%` },
              dragging ? styles.markerActive : null,
            ]}
          />
        </View>
      </View>
      <View style={styles.trackLabels}>
        <Text style={styles.trackLabel}>0</Text>
        <Text style={styles.trackLabel}>100 %</Text>
      </View>
    </View>
  );
}

function RankDistributionDetail({
  distribution,
  highlightIndex,
}: {
  distribution: RankDistribution;
  highlightIndex: number;
}) {
  const maxCount = Math.max(...distribution.buckets.map((b) => b.count), 1);
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";
  const bucketLabel = spelledBucketLabel(distribution, highlightIndex, locale);

  return (
    <View style={styles.detail}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {distribution.buckets.map((b, i) => {
          const h =
            b.count > 0
              ? Math.max((b.count / maxCount) * CHART_HEIGHT, 3)
              : 0;
          return (
            <View key={`${b.label}-${i}`} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor:
                      i === highlightIndex ? colors.brand : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      {bucketLabel ? (
        <Text style={styles.bucketHint}>{bucketLabel}</Text>
      ) : null}
    </View>
  );
}

export function RankPanel({
  distribution,
  userMe,
  onScrollLockChange,
}: Props) {
  const me =
    typeof userMe === "number" ? userMe : distribution.user_merits;
  // People-weighted: drives the headline ("top half", etc.).
  const percentile =
    typeof me === "number"
      ? percentileFromDistribution(distribution, me)
      : null;
  // Equal band widths: runner lines up with histogram column boundaries.
  const sliderPos =
    typeof me === "number"
      ? sliderPositionFromMe(distribution, me)
      : null;

  const [dragState, setDragState] = useState({
    dragging: false,
    probePct: sliderPos ?? 0,
  });

  useEffect(() => {
    onScrollLockChange?.(dragState.dragging);
    return () => onScrollLockChange?.(false);
  }, [dragState.dragging, onScrollLockChange]);

  if (percentile === null || sliderPos === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.headline}>{t("home.rank_anonymous")}</Text>
      </View>
    );
  }

  const probeBucketIndex = dragState.dragging
    ? bucketIndexFromSlider(distribution, dragState.probePct)
    : -1;
  const probeBucketCount =
    probeBucketIndex >= 0
      ? (distribution.buckets[probeBucketIndex]?.count ?? 0)
      : 0;
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";

  return (
    <View style={styles.card}>
      <HeadlineWithLinks text={t(headlineKey(percentile))} />
      <Text style={styles.caption}>{t("home.rank_caption")}</Text>

      <View style={styles.ladderWrap}>
        {dragState.dragging && probeBucketIndex >= 0 ? (
          <View style={styles.probeOverlay} pointerEvents="none">
            <Text style={styles.probeHint}>
              {t("home.rank_probe_prefix")}{" "}
              <Text style={styles.probeCount}>
                {probeBucketCount.toLocaleString(locale)}
              </Text>
            </Text>
            <RankDistributionDetail
              distribution={distribution}
              highlightIndex={probeBucketIndex}
            />
          </View>
        ) : null}

        <RankLadder
          userPercentile={sliderPos}
          onDragStateChange={setDragState}
        />
      </View>
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
  caption: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  ladderWrap: {
    position: "relative",
    zIndex: 1,
  },
  probeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    gap: 8,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    zIndex: 2,
  },
  ladder: {
    gap: 4,
    paddingTop: 4,
  },
  trackHit: {
    // Extra vertical hit area around the thin track.
    paddingVertical: 14,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    position: "relative",
    justifyContent: "center",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "#C5D0CA",
  },
  marker: {
    position: "absolute",
    top: "50%",
    width: MARKER,
    height: MARKER,
    marginLeft: -MARKER / 2,
    marginTop: -MARKER / 2,
    borderRadius: MARKER / 2,
    borderWidth: 2,
  },
  markerUser: {
    backgroundColor: colors.border,
    borderColor: colors.ink,
    zIndex: 1,
  },
  markerProbe: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    zIndex: 2,
  },
  markerActive: {
    transform: [{ scale: 1.1 }],
  },
  trackLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trackLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  probeHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  probeCount: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.brand,
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
  bar: {
    width: "100%",
    borderRadius: 2,
  },
  bucketHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
});
