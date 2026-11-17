import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

export type SectionTabOption<T extends string> = {
  id: T;
  label: string;
};

type SectionTabsProps<T extends string> = {
  tabs: ReadonlyArray<SectionTabOption<T>>;
  value: T;
  onChange: (id: T) => void;
};

/**
 * Exclusive pill section switcher (same visual as receipts history tabs).
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
}: SectionTabsProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, selected && styles.tabActive]}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.tabText, selected && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: "#fff",
  },
});
