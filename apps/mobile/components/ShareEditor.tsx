import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { colors } from "@/constants/theme";
import {
  formatShareMerits,
  shareSum,
  type SplitRecipient,
} from "@/lib/split-shares";
import { t } from "@/lib/i18n";

type Props = {
  recipients: SplitRecipient[];
  totalMerits: number;
  onChangeShare: (rovasUid: string, sharePct: number) => void;
  onToggleAlways: (rovasUid: string, alwaysShare: boolean) => void;
  onRemove: (rovasUid: string) => void;
  onAddPerson: () => void;
};

export function ShareEditor({
  recipients,
  totalMerits,
  onChangeShare,
  onToggleAlways,
  onRemove,
  onAddPerson,
}: Props) {
  const sum = shareSum(recipients);
  const sumOk = Math.abs(sum - 100) < 0.01;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("receipts.split_title")}</Text>
        <Pressable style={styles.addBtn} onPress={onAddPerson}>
          <Text style={styles.addBtnText}>{t("receipts.split_add")}</Text>
        </Pressable>
      </View>

      {recipients.map((r) => (
        <View key={r.rovas_uid} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Text style={styles.name}>
                {r.isScanner
                  ? `${t("receipts.split_you")} (${r.username})`
                  : r.username}
              </Text>
            </View>
            <TextInput
              value={String(r.sharePct)}
              onChangeText={(v) => {
                const n = Number(String(v).replace(",", "."));
                onChangeShare(r.rovas_uid, Number.isFinite(n) ? n : 0);
              }}
              keyboardType="decimal-pad"
              style={styles.pctInput}
            />
            <Text style={styles.pctSuffix}>%</Text>
            <Text style={styles.me}>
              {formatShareMerits(totalMerits, r.sharePct)} {t("common.me")}
            </Text>
          </View>
          {!r.isScanner ? (
            <View style={styles.footer}>
              <View style={styles.toggleRow}>
                <Switch
                  value={r.alwaysShare}
                  onValueChange={(v) => onToggleAlways(r.rovas_uid, v)}
                  trackColor={{ false: colors.border, true: colors.brandSoft }}
                />
                <Text style={styles.toggleLabel}>{t("receipts.split_always")}</Text>
              </View>
              <Pressable
                onPress={() => onRemove(r.rovas_uid)}
                hitSlop={8}
                accessibilityLabel={t("receipts.split_remove")}
              >
                <Text style={styles.remove}>×</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      <Text style={[styles.sum, !sumOk && styles.sumBad]}>
        {t("receipts.split_sum")}: {sum.toFixed(0)} %
      </Text>
      <Text style={styles.hint}>{t("receipts.split_residue")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  addBtnText: { color: colors.brandSoft, fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  name: { fontWeight: "600", color: colors.ink, fontSize: 14 },
  pctInput: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "right",
    color: colors.ink,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  pctSuffix: { color: colors.muted, fontSize: 13 },
  me: {
    minWidth: 56,
    textAlign: "right",
    fontWeight: "600",
    color: colors.ink,
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  toggleLabel: { color: colors.muted, fontSize: 12, flex: 1 },
  remove: { color: colors.muted, fontSize: 22, fontWeight: "600", paddingHorizontal: 4 },
  sum: { color: colors.muted, fontSize: 13 },
  sumBad: { color: colors.danger, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
