import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NaceNode } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  tree: NaceNode[];
  selectedTid: string | null;
  onSelect: (node: NaceNode) => void;
};

export function NacePicker({ tree, selectedTid, onSelect }: Props) {
  const [path, setPath] = useState<NaceNode[]>([]);

  const level = path.length === 0 ? tree : (path[path.length - 1]?.children ?? []);
  const current = path.length > 0 ? path[path.length - 1] : null;
  const selectedLabel = useMemo(
    () => (selectedTid ? findLabel(tree, selectedTid) : null),
    [tree, selectedTid],
  );

  return (
    <View style={styles.wrap}>
      {selectedLabel ? (
        <Text style={styles.selected}>{selectedLabel}</Text>
      ) : null}
      {path.length > 0 ? (
        <Pressable
          onPress={() => setPath((p) => p.slice(0, -1))}
          style={styles.back}
        >
          <Text style={styles.backText}>{t("volunteer.nace_back")}</Text>
        </Pressable>
      ) : null}
      {current ? (
        <Pressable
          style={styles.pickCurrent}
          onPress={() => onSelect(current)}
        >
          <Text style={styles.pickCurrentText}>
            {t("volunteer.nace_select")}: {formatNode(current)}
          </Text>
        </Pressable>
      ) : null}
      {level.map((node) => (
        <Pressable
          key={node.tid}
          style={[
            styles.row,
            selectedTid === node.tid && styles.rowSelected,
          ]}
          onPress={() => {
            if (node.children.length > 0) {
              setPath((p) => [...p, node]);
            } else {
              onSelect(node);
            }
          }}
        >
          <Text style={styles.rowText}>{formatNode(node)}</Text>
          {node.children.length > 0 ? (
            <Text style={styles.chevron}>›</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function formatNode(node: NaceNode): string {
  return node.code ? `${node.code} ${node.label}` : node.label;
}

function findLabel(nodes: NaceNode[], tid: string): string | null {
  for (const n of nodes) {
    if (n.tid === tid) return formatNode(n);
    const nested = findLabel(n.children, tid);
    if (nested) return nested;
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  selected: { color: colors.brandSoft, fontWeight: "600", fontSize: 13 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { color: colors.brand, fontWeight: "700" },
  pickCurrent: {
    backgroundColor: "#E8EFEA",
    borderRadius: 10,
    padding: 10,
  },
  pickCurrentText: { color: colors.ink, fontWeight: "600", fontSize: 13 },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowSelected: { borderColor: colors.brand },
  rowText: { color: colors.ink, flex: 1, fontSize: 14 },
  chevron: { color: colors.muted, fontSize: 20, marginLeft: 8 },
});
