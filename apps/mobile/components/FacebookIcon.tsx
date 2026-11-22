import Svg, { Path, Rect } from "react-native-svg";

type Props = {
  size?: number;
};

/** Classic Facebook mark from Rovas HybridAuth icon pack. */
export function FacebookIcon({ size = 28 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 36.083 35.917"
      accessibilityRole="image"
      accessibilityLabel="Facebook"
    >
      <Path
        fill="#3B5998"
        d="M36.028,33.702c0,1.282-1.044,2.323-2.326,2.323H2.324C1.042,36.025,0,34.984,0,33.702V2.324C0,1.04,1.042,0,2.324,0h31.378c1.282,0,2.326,1.04,2.326,2.324V33.702z"
      />
      <Rect x="1.065" y="28.175" fill="#6D84B4" width="33.896" height="5.24" />
      <Path
        fill="#FFFFFF"
        d="M26.547,33.416h-6.15v-14.89h-3.073v-5.131h3.073v-3.08c0-4.186,1.733-6.674,6.664-6.674h4.105v5.131h-2.564c-1.921,0-2.049,0.718-2.049,2.056l-0.006,2.568h4.647l-0.545,5.131h-4.103V33.416z"
      />
    </Svg>
  );
}
