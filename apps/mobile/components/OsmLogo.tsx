import { Image, type ImageStyle, type StyleProp } from "react-native";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** OpenStreetMap mark from Rovas HybridAuth icon pack. */
export function OsmLogo({ size = 32, style }: Props) {
  return (
    <Image
      source={require("../assets/images/osm-logo.png")}
      accessibilityLabel="OpenStreetMap"
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}
