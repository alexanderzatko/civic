import { StyleSheet, Text, View } from "react-native";
import { displayMerits, type UserLookupProjectRow } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  rows: UserLookupProjectRow[];
  emptyLabel: string;
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

export function ProjectMeTable({ rows, emptyLabel }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.table}>
      <View style={styles.header}>
        <Text style={[styles.th, styles.colName]}>{t("community.col_name")}</Text>
        <Text style={[styles.th, styles.colMe]}>{t("common.me")}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.name} style={styles.row}>
          <Text style={[styles.td, styles.colName]} numberOfLines={2}>
            {r.name}
          </Text>
          <Text style={[styles.tdMe, styles.colMe]}>{formatMe(r.me)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: colors.muted },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#EEF2EF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  th: { fontSize: 12, fontWeight: "600", color: colors.muted },
  td: { fontSize: 14, color: colors.ink },
  tdMe: { fontSize: 14, fontWeight: "600", color: colors.ink },
  colName: { flex: 1 },
  colMe: { width: 64, textAlign: "right" },
});
