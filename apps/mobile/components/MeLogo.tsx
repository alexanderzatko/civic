import { Image, type ImageStyle, type StyleProp } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Merit (ME) brand mark — cropped from identity/ME_logo.svg. */
export function MeLogo({ size = 56, style }: Props) {
  return (
    <Image
      source={require("../assets/images/me-logo.png")}
      accessibilityLabel="Logo Merit (ME)"
      resizeMode="contain"
      style={[
        {
          width: size,
          height: size * (112 / 165),
          tintColor: colors.ink,
        },
        style,
      ]}
    />
  );
}
