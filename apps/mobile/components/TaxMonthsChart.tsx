import { StyleSheet, Text, View } from "react-native";
import { displayMerits, type UserLookupTaxMonth } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  months: UserLookupTaxMonth[];
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

export function TaxMonthsChart({ months }: Props) {
  if (months.length === 0) {
    return <Text style={styles.empty}>{t("community.taxes_empty")}</Text>;
  }

  const total = months.reduce((a, m) => a + m.me, 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{t("community.taxes_hint")}</Text>
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
  total: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
  },
});
