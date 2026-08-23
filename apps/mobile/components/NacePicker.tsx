import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from "react-native";
import type { NaceNode } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

/** ~one NACE row; nudge at most two rows when children sit below the fold. */
const ROW_HEIGHT_APPROX = 48;
const MAX_NUDGE = ROW_HEIGHT_APPROX * 2;
const BOTTOM_PAD = 28;

type Props = {
  tree: NaceNode[];
  selectedTid: string | null;
  onSelect: (node: NaceNode) => void;
  /** Parent form ScrollView — gentle reveal scroll only on drill-down. */
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
  const firstChildRef = useRef<View>(null);
  const pathLenRef = useRef(0);

  const level =
    path.length === 0 ? tree : (path[path.length - 1]?.children ?? []);
  const current = path.length > 0 ? path[path.length - 1] : null;
  const selectedLabel = useMemo(
    () => (selectedTid ? findLabel(tree, selectedTid) : null),
    [tree, selectedTid],
  );

  // After drill-down only: if the first new child row sits below the fold,
  // scroll down a line or two. Never scroll up — layout shrink handles that.
  useEffect(() => {
    const prevLen = pathLenRef.current;
    pathLenRef.current = path.length;
    if (path.length <= prevLen || !scrollRef?.current || path.length === 0) {
      return;
    }

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        firstChildRef.current?.measureInWindow((_x, y, _w, h) => {
          if (cancelled) return;
          if (typeof y !== "number" || Number.isNaN(y)) return;

          const bottom = y + Math.max(h, ROW_HEIGHT_APPROX);
          const maxVisible = Dimensions.get("window").height - BOTTOM_PAD;
          const overflow = bottom - maxVisible;
          if (overflow <= 0) return;

          const scrollY = getScrollY?.() ?? 0;
          const nudge = Math.min(overflow, MAX_NUDGE);
          scrollRef.current?.scrollTo({
            y: scrollY + nudge,
            animated: true,
          });
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [path, scrollRef, getScrollY]);

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
        <Pressable style={styles.pickCurrent} onPress={() => onSelect(current)}>
          <Text style={styles.pickCurrentText}>
            {t("volunteer.nace_select")}: {formatNode(current)}
          </Text>
        </Pressable>
      ) : null}
      {level.map((node, index) => (
        <View
          key={node.tid}
          ref={index === 0 && path.length > 0 ? firstChildRef : undefined}
          collapsable={false}
        >
          <Pressable
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
        </View>
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
