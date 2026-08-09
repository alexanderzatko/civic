import { StyleSheet, Text, View } from "react-native";
import { displayMerits, type UserLookupTaxMonth } from "@civic/shared";
import { colors } from "@/constants/theme";
import { getLocale, t } from "@/lib/i18n";

type Props = {
  months: UserLookupTaxMonth[];
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  const locale = getLocale() === "sk" ? "sk-SK" : "en-US";
  return d.toLocaleDateString(locale, { month: "short" });
}

export function TaxMonthsChart({ months }: Props) {
  if (months.length === 0) {
    return <Text style={styles.empty}>{t("community.taxes_empty")}</Text>;
  }

  const max = Math.max(...months.map((m) => m.me), 1);
  const total = months.reduce((a, m) => a + m.me, 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{t("community.taxes_hint")}</Text>
      <View style={styles.chart}>
        {months.map((m) => {
          const h = Math.max((m.me / max) * 100, m.me > 0 ? 4 : 0);
          return (
            <View key={m.month} style={styles.col}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${h}%` }]} />
              </View>
              <Text style={styles.me}>{formatMe(m.me)}</Text>
              <Text style={styles.label}>{monthLabel(m.month)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.total}>
        {t("community.taxes_total")}: {formatMe(total)} {t("common.me")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: { fontSize: 13, color: colors.muted },
  empty: { fontSize: 13, color: colors.muted },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    height: 140,
  },
  col: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: {
    flex: 1,
    width: "70%",
    justifyContent: "flex-end",
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
    minHeight: 80,
  },
  bar: {
    width: "100%",
    backgroundColor: "#3B6EA5",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  me: { fontSize: 11, color: colors.ink, fontWeight: "600" },
  label: { fontSize: 11, color: colors.muted },
  total: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
  },
});
