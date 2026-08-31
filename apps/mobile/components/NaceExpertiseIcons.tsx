import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SvgCssUri } from "react-native-svg/css";
import { displayMerits, type NaceExpertiseSection } from "@civic/shared";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  sections: NaceExpertiseSection[];
  iconSize?: number;
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function ExpertiseIcon({
  section,
  size,
  onPress,
}: {
  section: NaceExpertiseSection;
  size: number;
  onPress: () => void;
}) {
  const [svgFailed, setSvgFailed] = useState(false);
  const letter = (section.section_letter || section.section_label.charAt(0))
    .toUpperCase()
    .slice(0, 1);

  return (
    <Pressable
      style={[styles.iconBtn, { width: size + 12, height: size + 12 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={section.section_label}
    >
      {!svgFailed && section.icon_url ? (
        <SvgCssUri
          uri={section.icon_url}
          width={size}
          height={size}
          onError={() => setSvgFailed(true)}
        />
      ) : (
        <View style={[styles.letterBadge, { width: size, height: size }]}>
          <Text style={[styles.letterText, { fontSize: size * 0.55 }]}>
            {letter}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function NaceExpertiseIcons({ sections, iconSize = 24 }: Props) {
  const [selected, setSelected] = useState<NaceExpertiseSection | null>(null);

  if (!sections.length) {
    return null;
  }

  const rowHeight = iconSize + 12;

  const rateLabel = (section: NaceExpertiseSection) => {
    const prefix =
      section.hourly_rate_eur === 10
        ? t("expertise.rate_default")
        : t("expertise.rate_estimated");
    return `${prefix}: ${section.hourly_rate_eur} ${t("expertise.per_hour")}`;
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={[styles.scroll, { height: rowHeight }]}
      >
        {sections.map((section) => (
          <ExpertiseIcon
            key={section.section_tid}
            section={section}
            size={iconSize}
            onPress={() => setSelected(section)}
          />
        ))}
      </ScrollView>

      <Modal
        visible={selected != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            {selected ? (
              <>
                <Text style={styles.cardTitle}>{selected.section_label}</Text>
                <Text style={styles.cardMe}>
                  {formatMe(selected.me)} {t("common.me")} ({selected.share_percent}
                  %)
                </Text>
                <Text style={styles.cardRate}>{rateLabel(selected)}</Text>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => setSelected(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.closeText}>{t("common.close")}</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    minWidth: "100%",
  },
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadge: {
    borderRadius: 6,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: {
    color: "#fff",
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    minWidth: 260,
    maxWidth: "100%",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  cardMe: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brand,
  },
  cardRate: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeText: {
    color: colors.brand,
    fontWeight: "600",
  },
});
