import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from "react-native";
import type { NaceNode } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  tree: NaceNode[];
  selectedTid: string | null;
  onSelect: (node: NaceNode) => void;
  /** Parent form ScrollView — compensates scroll on drill-down so the tap stays put. */
  scrollRef?: RefObject<ScrollView | null>;
  getScrollY?: () => number;
};

export function NacePicker({
  tree,
  selectedTid,
  onSelect,
  scrollRef,
  getScrollY,
}: Props) {
  const [path, setPath] = useState<NaceNode[]>([]);
  const revealRef = useRef<View>(null);
  /** Window Y of the row the user tapped; consumed after the next level paints. */
  const pendingAnchorY = useRef<number | null>(null);

  const level =
    path.length === 0 ? tree : (path[path.length - 1]?.children ?? []);
  const current = path.length > 0 ? path[path.length - 1] : null;
  const levelIndent = path.length * 5;
  const parentIndent = path.length > 0 ? (path.length - 1) * 5 : 0;
  const selectedLabel = useMemo(
    () => (selectedTid ? findLabel(tree, selectedTid) : null),
    [tree, selectedTid],
  );

  // After drill-down: scroll just enough so the reveal row sits where the user tapped.
  useEffect(() => {
    const anchorY = pendingAnchorY.current;
    if (anchorY == null || !scrollRef?.current) return;

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        revealRef.current?.measureInWindow((_x, revealY) => {
          if (cancelled) return;
          pendingAnchorY.current = null;
          if (typeof revealY !== "number" || Number.isNaN(revealY)) return;

          const scrollY = getScrollY?.() ?? 0;
          const nextY = scrollY + (revealY - anchorY);
          if (Math.abs(nextY - scrollY) < 1) return;
          scrollRef.current?.scrollTo({
            y: Math.max(0, nextY),
            animated: false,
          });
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [path, scrollRef, getScrollY]);

  const drillInto = (node: NaceNode, row: View | null) => {
    if (!row || !scrollRef) {
      setPath((p) => [...p, node]);
      return;
    }
    row.measureInWindow((_x, tapY) => {
      pendingAnchorY.current =
        typeof tapY === "number" && !Number.isNaN(tapY) ? tapY : null;
      setPath((p) => [...p, node]);
    });
  };

  return (
    <View style={styles.wrap}>
      {selectedLabel ? (
        <Text style={styles.selected}>{selectedLabel}</Text>
      ) : null}
      {path.length > 0 ? (
        <Pressable
          onPress={() => {
            pendingAnchorY.current = null;
            setPath((p) => p.slice(0, -1));
          }}
          style={styles.back}
        >
          <Text style={styles.backText}>{t("volunteer.nace_back")}</Text>
        </Pressable>
      ) : null}
      {current ? (
        <View
          ref={revealRef}
          style={{ marginLeft: parentIndent }}
          collapsable={false}
        >
          <Pressable
            style={[styles.row, styles.rowActive]}
            onPress={() => onSelect(current)}
          >
            <Text style={[styles.rowText, styles.rowTextActive]}>
              {formatNode(current)}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      ) : null}
      {level.map((node, index) => (
        <NaceRow
          key={node.tid}
          node={node}
          indent={levelIndent}
          selected={selectedTid === node.tid}
          isRevealAnchor={!current && index === 0}
          revealRef={revealRef}
          onPress={(row) => {
            if (node.children.length > 0) {
              drillInto(node, row);
            } else {
              onSelect(node);
            }
          }}
        />
      ))}
    </View>
  );
}

function NaceRow({
  node,
  indent,
  selected,
  onPress,
  isRevealAnchor,
  revealRef,
}: {
  node: NaceNode;
  indent: number;
  selected: boolean;
  onPress: (row: View | null) => void;
  isRevealAnchor: boolean;
  revealRef: RefObject<View | null>;
}) {
  const rowRef = useRef<View>(null);
  return (
    <View
      ref={(el) => {
        rowRef.current = el;
        if (isRevealAnchor) {
          revealRef.current = el;
        }
      }}
      style={indent > 0 ? { marginLeft: indent } : undefined}
      collapsable={false}
    >
      <Pressable
        style={[styles.row, selected && styles.rowActive]}
        onPress={() => onPress(rowRef.current)}
      >
        <Text style={[styles.rowText, selected && styles.rowTextActive]}>
          {formatNode(node)}
        </Text>
        {node.children.length > 0 ? (
          <Text style={styles.chevron}>›</Text>
        ) : null}
      </Pressable>
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
  rowActive: { backgroundColor: "#E8EFEA" },
  rowText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "400" },
  rowTextActive: { fontWeight: "700" },
  chevron: { color: colors.muted, fontSize: 20, marginLeft: 8 },
});
