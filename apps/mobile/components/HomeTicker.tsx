import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { displayMerits } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchMeritSpotlight } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const DEFAULT_COUNTRY = "SK";
const REFRESH_MS = 60_000;
const SPINNER_SIZE = 26;
const TICK_MS = 50;

/** Quiet spinner stroke / fill — readable, not attention-seeking. */
const SPINNER_STROKE = "#9AABA2";
const SPINNER_FILL = "#C5D0CA";
const SPINNER_DOT = "#8A9A92";

type TickerStats = {
  communityEarnedMe: number;
  activeEarners: number;
};

function formatMe(n: number, locale: Locale): string {
  const numLocale = locale === "sk" ? "sk-SK" : "en-US";
  return displayMerits(n).toLocaleString(numLocale);
}

function formatCount(n: number, locale: Locale): string {
  const numLocale = locale === "sk" ? "sk-SK" : "en-US";
  return n.toLocaleString(numLocale);
}

/** Filled pie with a cutout wedge; `remaining` 1 = full, 0 = empty. */
function WedgeSpinner({
  remaining,
  refreshing,
}: {
  remaining: number;
  refreshing: boolean;
}) {
  const r = SPINNER_SIZE / 2 - 1.5;
  const cx = SPINNER_SIZE / 2;
  const cy = SPINNER_SIZE / 2;
  const clamped = Math.min(1, Math.max(0, remaining));

  // Full circle when remaining ≈ 1; shrink clockwise from 12 o'clock.
  let pie: string | null = null;
  if (clamped > 0.001 && clamped < 0.999) {
    const sweep = clamped * 2 * Math.PI;
    const start = -Math.PI / 2;
    const end = start + sweep;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    pie = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  return (
    <Svg width={SPINNER_SIZE} height={SPINNER_SIZE}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill={colors.surface}
        stroke={SPINNER_STROKE}
        strokeWidth={1.25}
      />
      {clamped >= 0.999 ? (
        <Circle cx={cx} cy={cy} r={r - 0.5} fill={SPINNER_FILL} />
      ) : pie ? (
        <Path d={pie} fill={SPINNER_FILL} />
      ) : null}
      {refreshing ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r * 0.35}
          fill={SPINNER_DOT}
          opacity={0.7}
        />
      ) : null}
    </Svg>
  );
}

/**
 * Live “today” community ticker: ME credited + active earners on the
 * Bratislava calendar day, with a 1-minute wedge countdown (tap to refresh).
 */
export function HomeTicker() {
  const { status } = useAuth();
  const { locale } = useLocale();
  const [stats, setStats] = useState<TickerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remaining, setRemaining] = useState(1);
  const deadlineRef = useRef(Date.now() + REFRESH_MS);
  const inFlightRef = useRef(false);

  const load = useCallback(async (manual: boolean) => {
    if (status === "loading") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (manual) setRefreshing(true);
    try {
      const page = await fetchMeritSpotlight({
        period: "today",
        country_iso2: DEFAULT_COUNTRY,
        lang: getLocale(),
      });
      // Empty 404 payload from Civic has blank period_start — keep last good.
      if (page.period_start) {
        setStats({
          communityEarnedMe: page.community_earned_me,
          activeEarners: page.active_earners,
        });
      }
    } catch {
      // Keep last good values.
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      deadlineRef.current = Date.now() + REFRESH_MS;
      setRemaining(1);
    }
  }, [status, locale]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        void load(false);
        return;
      }
      setRemaining(left / REFRESH_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [load]);

  const onPressSpinner = () => {
    void load(true);
  };

  const meLabel = stats ? formatMe(stats.communityEarnedMe, locale) : "—";
  const usersLabel = stats ? formatCount(stats.activeEarners, locale) : "—";
  const a11y = t("home.ticker_a11y")
    .replace("{{me}}", meLabel)
    .replace("{{users}}", usersLabel);

  return (
    <View style={styles.stripe} accessibilityLabel={a11y}>
      <View style={styles.dayCol}>
        {/* Rotated: "Civic", then dominant "today"/"dnes". */}
        <View style={styles.dayLabelWrap}>
          <Text style={styles.dayLabelCivic}>{t("home.ticker_brand")}</Text>
          <Text
            style={styles.dayLabelToday}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {t("home.ticker_today")}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.statCol}>
        <Text style={styles.meUnit}>{t("common.me")}</Text>
        {loading && !stats ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : (
          <Text style={styles.meValue}>{meLabel}</Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.statCol}>
        <MaterialIcons name="person" size={16} color={colors.muted} />
        {loading && !stats ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : (
          <Text style={styles.usersValue}>{usersLabel}</Text>
        )}
      </View>

      <View style={styles.divider} />

      <Pressable
        onPress={onPressSpinner}
        style={styles.spinnerHit}
        accessibilityRole="button"
        accessibilityLabel={t("home.ticker_refresh_a11y")}
        disabled={refreshing}
      >
        <WedgeSpinner remaining={remaining} refreshing={refreshing} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Full-bleed strip under the nav title bar — not a card. */
  stripe: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 44,
  },
  dayCol: {
    // Fits two rotated lines (Civic / today) without clipping.
    width: 34,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  dayLabelWrap: {
    transform: [{ rotate: "-90deg" }],
    alignItems: "center",
    // Wide enough for "today" at dayLabelToday fontSize; adjustsFontSizeToFit
    // shrinks only if a larger dynamic type setting would overflow.
    width: 56,
  },
  dayLabelCivic: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.muted,
    letterSpacing: 0.2,
    lineHeight: 11,
    textAlign: "center",
  },
  dayLabelToday: {
    width: "100%",
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: 0.05,
    lineHeight: 19,
    textAlign: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  statCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  meUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  meValue: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6B8499",
    lineHeight: 20,
  },
  usersValue: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6B8A78",
    lineHeight: 20,
  },
  spinnerHit: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
