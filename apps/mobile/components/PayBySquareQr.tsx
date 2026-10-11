import { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  quietZone?: number;
  /** Forwarded to react-native-svg for toDataURL capture. */
  getRef?: (c: unknown) => void;
};

/**
 * Solid-module PAY by square QR (filled cells, not stroked paths).
 * Bank scanners are pickier than consumer QR readers about module shape.
 */
export function PayBySquareQr({
  value,
  size = 280,
  quietZone = 16,
  getRef,
}: Props) {
  const matrix = useMemo(() => {
    const created = QRCode.create(value, { errorCorrectionLevel: "M" });
    const data = created.modules.data;
    const n = created.modules.size;
    const rows: boolean[][] = [];
    for (let y = 0; y < n; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < n; x++) {
        row.push(Boolean(data[y * n + x]));
      }
      rows.push(row);
    }
    return rows;
  }, [value]);

  const n = matrix.length;
  const cell = size / n;
  const total = size + quietZone * 2;

  return (
    <Svg
      ref={getRef as never}
      width={total}
      height={total}
      viewBox={`0 0 ${total} ${total}`}
    >
      <Rect x={0} y={0} width={total} height={total} fill="#FFFFFF" />
      {matrix.map((row, y) =>
        row.map((dark, x) =>
          dark ? (
            <Rect
              key={`${x}-${y}`}
              x={quietZone + x * cell}
              y={quietZone + y * cell}
              width={cell}
              height={cell}
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}
