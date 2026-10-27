import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import {
  displayMerits,
  type MeritSourceCategory,
  type MeritSpotlight as MeritSpotlightData,
  type MeritSpotlightLead,
  type MeritSpotlightPeriod,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMeritSpotlight } from "@/lib/api";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import {
  dismissSpotlight,
  isSpotlightDismissed,
} from "@/lib/spotlight-dismiss";

const DEFAULT_COUNTRY = "SK";
const PERIODS: MeritSpotlightPeriod[] = ["day", "week", "month"];
const CATEGORY_ORDER: MeritSourceCategory[] = [
  "taxes",
  "charity",
  "volunteer",
];

type Props = {
  /** Home: dismissible for the current login session. */
  variant: "home" | "impact";
};

function formatMe(n: number, locale: Locale): string {
  const numLocale = locale === "sk" ? "sk-SK" : "en-US";
  return displayMerits(n).toLocaleString(numLocale);
}

function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function categoryLabel(cat: MeritSourceCategory): string {
  switch (cat) {
    case "taxes":
      return t("earn.taxes");
    case "charity":
      return t("earn.charity");
    case "volunteer":
      return t("earn.volunteer");
  }
}

function categoryColor(cat: MeritSourceCategory): string {
  switch (cat) {
    case "taxes":
      return colors.catTaxes;
    case "charity":
      return colors.catCharity;
    case "volunteer":
      return colors.catVolunteer;
  }
}

function periodLabel(period: MeritSpotlightPeriod): string {
  return t(`spotlight.period_${period}`);
}

function isEndpointLive(data: MeritSpotlightData | null): boolean {
  return data != null && data.period_start !== "";
}

function isThinPeriod(leads: MeritSpotlightLead[]): boolean {
  return leads.length === 0;
}

/** Leads that display as a real positive ME amount (not rounded to 0). */
function visibleLeads(data: MeritSpotlightData): MeritSpotlightLead[] {
  return data.leads.filter((l) => displayMerits(l.earned_me) > 0);
}

export function MeritSpotlight({ variant }: Props) {
  const { status } = useAuth();
  const { locale } = useLocale();
  const signedIn = status === "signedIn";
  const [period, setPeriod] = useState<MeritSpotlightPeriod>("day");
  const [data, setData] = useState<MeritSpotlightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Re-show after each login (auth clears dismiss); sync local UI state.
  useEffect(() => {
    if (variant !== "home") {
      setDismissed(false);
      return;
    }
    setDismissed(isSpotlightDismissed());
  }, [variant, status]);

  const load = useCallback(async () => {
    if (status === "loading") return;
    setLoading(true);
    try {
      const page = await fetchMeritSpotlight({
        period,
        country_iso2: DEFAULT_COUNTRY,
        lang: getLocale(),
      });
      setData(page);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, status, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  function onDismiss() {
    setDismissed(true);
    dismissSpotlight();
  }

  // Home: hide only after the user dismisses this session.
  if (variant === "home") {
    if (dismissed) return null;
  }

  // Stay hidden until Rovas returns a real period window (empty 404 payload → hide).
  if (!isEndpointLive(data)) return null;

  const leads = visibleLeads(data!);
  const thin = isThinPeriod(leads);

  return (
    <View style={[styles.card, variant === "impact" && styles.cardImpact]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("spotlight.title")}</Text>
        {variant === "home" ? (
          <Pressable
            onPress={() => void onDismiss()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("spotlight.dismiss")}
          >
            <Text style={styles.dismiss}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Pressable
              key={p}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.periodChipText,
                  active && styles.periodChipTextActive,
                ]}
              >
                {periodLabel(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : null}

      {!loading && data && thin ? (
        <Text style={styles.thinMsg}>
          {interpolate(t("spotlight.thin_period"), {
            me: formatMe(data.community_earned_me, locale),
            period: periodLabel(period),
          })}
        </Text>
      ) : null}

      {!loading && data && !thin
        ? CATEGORY_ORDER.map((cat) => {
            const lead = leads.find((l) => l.category === cat);
            if (!lead) return null;
            return (
              <LeadRow
                key={cat}
                lead={lead}
                locale={locale}
                signedIn={signedIn}
              />
            );
          })
        : null}

      {variant === "home" ? (
        <Link href="/(tabs)/impact" asChild>
          <Pressable style={styles.meRankLink}>
            <Text style={styles.meRankLinkText}>
              {t("spotlight.open_merank")}
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function LeadRow({
  lead,
  locale,
  signedIn,
}: {
  lead: MeritSpotlightLead;
  locale: Locale;
  signedIn: boolean;
}) {
  const color = categoryColor(lead.category);

  function openProfile() {
    if (!signedIn) return;
    router.push(
      `/(tabs)/community/${encodeURIComponent(lead.username)}` as never,
    );
  }

  return (
    <View style={styles.leadRow}>
      <View style={[styles.areaDot, { backgroundColor: color }]} />
      <View style={styles.leadMain}>
        <Text style={styles.areaLabel}>{categoryLabel(lead.category)}</Text>
        <Pressable
          onPress={openProfile}
          disabled={!signedIn}
          accessibilityRole={signedIn ? "link" : "text"}
        >
          <Text
            style={signedIn ? styles.usernameLink : styles.username}
            numberOfLines={1}
          >
            @{lead.username}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.leadMe}>
        {formatMe(lead.earned_me, locale)} {t("common.me")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardImpact: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.muted,
    paddingHorizontal: 4,
  },
  periodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  periodChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  periodChipTextActive: {
    color: "#FFFFFF",
  },
  loader: { marginVertical: 8 },
  thinMsg: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  leadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  areaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  leadMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  areaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  username: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  usernameLink: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brand,
  },
  leadMe: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  meRankLink: {
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  meRankLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },
});
