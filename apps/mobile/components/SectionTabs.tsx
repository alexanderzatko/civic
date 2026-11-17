import type { ReactNode } from "react";
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
  /** Active panel — rendered in the cabinet drawer under the tabs. */
  children: ReactNode;
  /** Active tab / drawer accent (defaults to brand). */
  accentColor?: string;
};

const BORDER = 1.5;
const TAB_RADIUS = 10;

/**
 * File-cabinet section tabs — same metaphor as Home Merit sources
 * (`ContributionBreakdown`): active tab merges into the drawer below.
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
  accentColor = colors.brand,
}: SectionTabsProps<T>) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === tabs.length - 1;

  return (
    <View style={styles.cabinet}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <Pressable
              key={tab.id}
              style={[
                styles.tab,
                active ? styles.tabActive : styles.tabInactive,
                active && { borderColor: accentColor },
              ]}
              onPress={() => onChange(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? accentColor : colors.muted },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.drawer,
          { borderColor: accentColor },
          isFirst && styles.drawerFlushLeft,
          isLast && styles.drawerFlushRight,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cabinet: {
    width: "100%",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 4,
    borderWidth: BORDER,
    borderBottomWidth: 0,
    borderTopLeftRadius: TAB_RADIUS,
    borderTopRightRadius: TAB_RADIUS,
  },
  tabActive: {
    backgroundColor: colors.surface,
    marginBottom: -BORDER,
    paddingBottom: 12 + BORDER,
    zIndex: 2,
  },
  tabInactive: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    opacity: 0.85,
  },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  drawer: {
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderRadius: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 14,
    gap: 14,
    zIndex: 0,
  },
  drawerFlushLeft: {
    borderTopLeftRadius: 0,
  },
  drawerFlushRight: {
    borderTopRightRadius: 0,
  },
});
