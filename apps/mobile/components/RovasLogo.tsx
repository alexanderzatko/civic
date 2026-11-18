import { Image, type ImageStyle, type StyleProp } from "react-native";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Rovas brand mark (square abacus / tally logo). */
export function RovasLogo({ size = 16, style }: Props) {
  return (
    <Image
      source={require("../assets/images/rovas-logo.png")}
      accessibilityLabel="Rovas"
      resizeMode="contain"
      style={[{ width: size, height: size, borderRadius: 2 }, style]}
    />
  );
}
