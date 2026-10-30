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
const SPINNER_SIZE = 28;
const TICK_MS = 50;

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
        stroke={colors.brand}
        strokeWidth={1.5}
      />
      {clamped >= 0.999 ? (
        <Circle cx={cx} cy={cy} r={r - 0.5} fill={colors.brandSoft} />
      ) : pie ? (
        <Path d={pie} fill={colors.brandSoft} />
      ) : null}
      {refreshing ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r * 0.35}
          fill={colors.brand}
          opacity={0.85}
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
        <Text style={styles.dayLabel}>{t("home.ticker_today")}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.statCol}>
        <Text style={styles.meUnit}>{t("common.me")}</Text>
        {loading && !stats ? (
          <ActivityIndicator color={colors.catTaxes} size="small" />
        ) : (
          <Text style={styles.meValue}>{meLabel}</Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.statCol}>
        <MaterialIcons name="person" size={18} color={colors.ink} />
        {loading && !stats ? (
          <ActivityIndicator color={colors.ok} size="small" />
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  dayCol: {
    width: 22,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 0.4,
    textTransform: "lowercase",
    transform: [{ rotate: "-90deg" }],
    width: 52,
    textAlign: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.ink,
    marginHorizontal: 8,
    opacity: 0.35,
  },
  statCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  meUnit: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  meValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.catTaxes,
    lineHeight: 24,
  },
  usersValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ok,
    lineHeight: 24,
  },
  spinnerHit: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
