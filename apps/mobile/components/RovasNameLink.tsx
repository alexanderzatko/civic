import {
  Linking,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { RovasLogo } from "@/components/RovasLogo";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { getRovasSiteUrl } from "@/lib/legal-urls";

type Props = {
  /** Linked label; defaults to locale `common.rovas` (Rovas / Rováš). */
  label?: string;
  accessibilityLabel?: string;
  textStyle?: StyleProp<TextStyle>;
  logoSize?: number;
  url?: string;
};

/**
 * Inline Rovas brand: logo + tappable name (opens the Rovas site).
 * Nest inside a parent `<Text>` so wrapping stays continuous.
 */
export function RovasNameLink({
  label,
  accessibilityLabel,
  textStyle,
  logoSize = 14,
  url,
}: Props) {
  const name = label ?? t("common.rovas");
  const a11y = accessibilityLabel ?? t("about.open_rovas_a11y");
  return (
    <>
      <RovasLogo
        size={logoSize}
        style={{
          width: logoSize,
          height: logoSize,
          marginHorizontal: 3,
          transform: [{ translateY: 2 }],
        }}
      />
      <Text
        style={[styles.link, textStyle]}
        onPress={() => void Linking.openURL(url ?? getRovasSiteUrl())}
        accessibilityRole="link"
        accessibilityLabel={a11y}
      >
        {name}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.brand, fontWeight: "700" },
});
