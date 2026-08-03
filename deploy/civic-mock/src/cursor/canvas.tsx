/**
 * Minimal browser shim for cursor/canvas — enough to run the Civic mockup standalone.
 */
import {
  type CSSProperties,
  type JSX,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const palette = {
  foreground: "#E4E4E4EB",
  foregroundSecondary: "#E4E4E48D",
  foregroundTertiary: "#E4E4E45E",
  foregroundQuaternary: "#E4E4E442",
  editor: "#181818",
  chrome: "#141414",
  elevated: "#181818",
  fillPrimary: "#E4E4E430",
  fillSecondary: "#E4E4E41E",
  fillTertiary: "#E4E4E411",
  fillQuaternary: "#E4E4E40A",
  strokePrimary: "#E4E4E433",
  strokeSecondary: "#E4E4E41F",
  strokeTertiary: "#E4E4E414",
  strokeFocused: "#E4E4E4",
  accent: "#599CE7",
  buttonBackground: "#599CE7",
  buttonForeground: "#191c22",
  buttonHoverBackground: "#6AABE9",
  link: "#87c3ff",
};

const category = {
  gray: "#E4E4E48A",
  purple: "#9386F2",
  green: "#3FA266",
  yellow: "#F1B467",
  cyan: "#81A1C1",
  pink: "#B48EAD",
  blue: "#7BAFE9",
  orange: "#D08770",
};

const chartColors = ["#7BAFE9", "#3FA266", "#9386F2", "#F1B467", "#D08770", "#81A1C1"];

const toneColors: Record<string, string> = {
  success: category.green,
  danger: "#FC6B83",
  warning: category.yellow,
  info: category.blue,
  neutral: category.gray,
};

function buildTheme() {
  return {
    kind: "dark",
    palette,
    tokens: {} as never,
    bg: { editor: palette.editor, chrome: palette.chrome, elevated: palette.elevated },
    text: {
      primary: palette.foreground,
      secondary: palette.foregroundSecondary,
      tertiary: palette.foregroundTertiary,
      quaternary: palette.foregroundQuaternary,
      link: palette.link,
      onAccent: palette.buttonForeground,
    },
    stroke: {
      primary: palette.strokePrimary,
      secondary: palette.strokeSecondary,
      tertiary: palette.strokeTertiary,
      focused: palette.strokeFocused,
    },
    fill: {
      primary: palette.fillPrimary,
      secondary: palette.fillSecondary,
      tertiary: palette.fillTertiary,
      quaternary: palette.fillQuaternary,
    },
    accent: {
      primary: palette.accent,
      control: palette.buttonBackground,
      controlHover: palette.buttonHoverBackground,
    },
    diff: {
      insertedLine: "#3FA26633",
      removedLine: "#B8004933",
      stripAdded: "#3FA2668F",
      stripRemoved: "#FC6B838F",
    },
    category,
  };
}

export type CanvasHostTheme = ReturnType<typeof buildTheme>;

const ThemeCtx = createContext(buildTheme());
const StateCtx = createContext<{
  get: <T>(key: string, def: T) => T;
  set: <T>(key: string, value: T | ((prev: T) => T)) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(() => buildTheme(), []);
  const [store, setStore] = useState<Record<string, unknown>>(() => {
    try {
      const raw = localStorage.getItem("civic-mock-state");
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  });

  const api = useMemo(
    () => ({
      get: <T,>(key: string, def: T): T =>
        (key in store ? (store[key] as T) : def),
      set: <T,>(key: string, value: T | ((prev: T) => T)) => {
        setStore((prev) => {
          const current = (key in prev ? prev[key] : undefined) as T;
          const next = typeof value === "function" ? (value as (p: T) => T)(current) : value;
          const updated = { ...prev, [key]: next };
          try {
            localStorage.setItem("civic-mock-state", JSON.stringify(updated));
          } catch {
            /* ignore */
          }
          return updated;
        });
      },
    }),
    [store],
  );

  return (
    <ThemeCtx.Provider value={theme}>
      <StateCtx.Provider value={api}>{children}</StateCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export function useHostTheme(): CanvasHostTheme {
  return useContext(ThemeCtx);
}

export function useCanvasState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const ctx = useContext(StateCtx)!;
  const value = ctx.get(key, defaultValue);
  const setValue = useCallback(
    (action: T | ((prev: T) => T)) => ctx.set(key, action),
    [ctx, key],
  );
  return [value, setValue];
}

export function mergeStyle(base: CSSProperties, override?: CSSProperties): CSSProperties {
  return { ...base, ...override };
}

export function Stack({ children, gap = 0, style }: { children?: ReactNode; gap?: number; style?: CSSProperties }) {
  return <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>{children}</div>;
}

export function Row({
  children,
  gap = 0,
  align,
  justify,
  wrap,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  wrap?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Grid({
  children,
  columns,
  gap = 0,
  style,
}: {
  children?: ReactNode;
  columns: number | string;
  gap?: number;
  style?: CSSProperties;
}) {
  const cols = typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;
  return <div style={{ display: "grid", gridTemplateColumns: cols, gap, ...style }}>{children}</div>;
}

export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

export function H1({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return <h1 style={{ margin: 0, fontSize: 24, lineHeight: "30px", fontWeight: 590, color: t.text.primary, ...style }}>{children}</h1>;
}

export function H2({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 590, color: t.text.primary, ...style }}>{children}</h2>;
}

export function H3({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return <h3 style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 590, color: t.text.primary, ...style }}>{children}</h3>;
}

export function Text({
  children,
  tone = "primary",
  size = "body",
  weight,
  as: Tag = "p",
  style,
}: {
  children?: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "quaternary";
  size?: "body" | "small";
  weight?: "regular" | "semibold";
  as?: "p" | "span";
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const color = t.text[tone];
  const fontSize = size === "small" ? 12 : 14;
  const lineHeight = size === "small" ? "16px" : "20px";
  const fontWeight = weight === "semibold" ? 600 : 400;
  return <Tag style={{ margin: 0, color, fontSize, lineHeight, fontWeight, ...style }}>{children}</Tag>;
}

export function Button({
  children,
  variant = "secondary",
  onClick,
  disabled,
  style,
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    padding: "0 12px",
    borderRadius: 6,
    font: "inherit",
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: `1px solid ${t.stroke.primary}`,
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: t.accent.control, color: t.text.onAccent, borderColor: "transparent" },
    secondary: { background: t.fill.tertiary, color: t.text.primary },
    ghost: { background: "transparent", color: t.text.primary, borderColor: "transparent" },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Pill({
  children,
  active,
  onClick,
  size = "md",
  leadingContent,
}: {
  children?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  leadingContent?: ReactNode;
}) {
  const t = useHostTheme();
  const pad = size === "sm" ? "2px 8px" : "4px 12px";
  const fontSize = size === "sm" ? 11 : 13;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        fontSize,
        borderRadius: 9999,
        border: `1px solid ${active ? t.accent.primary : t.stroke.secondary}`,
        background: active ? t.fill.secondary : t.fill.tertiary,
        color: active ? t.text.primary : t.text.secondary,
        cursor: onClick ? "pointer" : "default",
        font: "inherit",
      }}
    >
      {leadingContent}
      {children}
    </button>
  );
}

export function Card({
  children,
  collapsible,
  defaultOpen,
}: {
  children?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useHostTheme();
  const [open, setOpen] = useState(defaultOpen ?? true);
  if (collapsible) {
    return (
      <div style={{ border: `1px solid ${t.stroke.primary}`, borderRadius: 8, overflow: "hidden" }}>
        <div onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
          {Array.isArray(children) ? children[0] : children}
        </div>
        {open && (Array.isArray(children) ? children.slice(1) : null)}
      </div>
    );
  }
  return <div style={{ border: `1px solid ${t.stroke.primary}`, borderRadius: 8, overflow: "hidden" }}>{children}</div>;
}

export function CardHeader({ children, trailing }: { children?: ReactNode; trailing?: ReactNode }) {
  const t = useHostTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${t.stroke.tertiary}`, fontWeight: 600, fontSize: 14, color: t.text.primary }}>
      <span style={{ flex: 1 }}>{children}</span>
      {trailing}
    </div>
  );
}

export function CardBody({ children }: { children?: ReactNode }) {
  return <div style={{ padding: 12 }}>{children}</div>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  const t = useHostTheme();
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: t.text.primary }}>{value}</div>
      <div style={{ fontSize: 12, color: t.text.tertiary }}>{label}</div>
    </div>
  );
}

export function Callout({
  children,
  tone = "info",
  title,
}: {
  children?: ReactNode;
  tone?: "info" | "warning" | "success" | "danger";
  title?: ReactNode;
}) {
  const t = useHostTheme();
  const border = toneColors[tone] ?? toneColors.info;
  return (
    <div style={{ borderLeft: `3px solid ${border}`, padding: "8px 12px", background: t.fill.quaternary, borderRadius: 4 }}>
      {title && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: t.text.primary }}>{title}</div>}
      <div style={{ fontSize: 13, color: t.text.secondary }}>{children}</div>
    </div>
  );
}

export function Link({ href, children }: { href: string; children?: ReactNode }) {
  const t = useHostTheme();
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: t.text.link, textDecoration: "none" }}>
      {children}
    </a>
  );
}

type TableRowTone = "success" | "danger" | "warning" | "info" | "neutral";

export function Table({
  headers,
  rows,
  columnAlign,
  rowTone,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  columnAlign?: Array<"left" | "center" | "right" | undefined>;
  rowTone?: Array<TableRowTone | undefined>;
}) {
  const t = useHostTheme();
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.stroke.primary}`, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: columnAlign?.[i] ?? "left",
                  padding: "8px 10px",
                  borderBottom: `1px solid ${t.stroke.tertiary}`,
                  color: t.text.secondary,
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? t.fill.quaternary : undefined }}>
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: columnAlign?.[ci] ?? "left",
                    padding: "8px 10px",
                    borderBottom: `1px solid ${t.stroke.tertiary}`,
                    color: t.text.primary,
                  }}
                >
                  {ci === 0 && rowTone?.[ri] && (
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: toneColors[rowTone[ri]!], marginRight: 6 }} />
                  )}
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  style,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%",
        height: 32,
        padding: "0 10px",
        borderRadius: 6,
        border: `1px solid ${t.stroke.primary}`,
        background: t.fill.quaternary,
        color: t.text.primary,
        font: "inherit",
        fontSize: 14,
        ...style,
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={{
        width: "100%",
        padding: 10,
        borderRadius: 6,
        border: `1px solid ${t.stroke.primary}`,
        background: t.fill.quaternary,
        color: t.text.primary,
        font: "inherit",
        fontSize: 14,
        resize: "vertical",
        ...style,
      }}
    />
  );
}

export function Select({
  options,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const t = useHostTheme();
  return (
    <select
      defaultValue=""
      style={{
        width: "100%",
        height: 32,
        padding: "0 10px",
        borderRadius: 6,
        border: `1px solid ${t.stroke.primary}`,
        background: t.fill.quaternary,
        color: t.text.primary,
        font: "inherit",
        fontSize: 14,
      }}
    >
      <option value="" disabled>
        {placeholder ?? "Vyberte…"}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange }: { checked?: boolean; onChange?: (v: boolean) => void }) {
  const t = useHostTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        background: checked ? t.accent.primary : t.fill.secondary,
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

type ChartSeries = { name: string; data: number[]; tone?: string };

export function BarChart({
  categories,
  series,
  height = 160,
  stacked,
  valueSuffix = "",
  valuePrefix = "",
  showValues,
}: {
  categories: string[];
  series: ChartSeries[];
  height?: number;
  stacked?: boolean;
  valueSuffix?: string;
  valuePrefix?: string;
  showValues?: boolean;
}) {
  const t = useHostTheme();
  const max = Math.max(...series.flatMap((s) => s.data), 1);
  const barW = Math.max(8, Math.min(24, 280 / categories.length / Math.max(series.length, 1)));
  const groupW = categories.length * (barW * series.length + 4);
  const fmt = (v: number) => `${valuePrefix}${v}${valueSuffix}`;
  const shouldShowValues =
    showValues ?? (series.length === 1 && categories.length <= 8);

  return (
    <div style={{ height, color: t.text.tertiary, fontSize: 10 }}>
      <svg width="100%" height={height - 20} viewBox={`0 0 ${Math.max(groupW, 300)} ${height - 20}`}>
        {categories.map((cat, ci) => {
          let stackY = height - 30;
          const groupX = ci * (barW * series.length + 8);
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const val = s.data[ci] ?? 0;
                const h = (val / max) * (height - 50);
                const x = groupX + si * barW;
                const y = stacked ? (stackY -= h) : height - 30 - h;
                const color = s.tone ? toneColors[s.tone] : chartColors[si % chartColors.length];
                if (val === 0) return null;
                return (
                  <g key={s.name}>
                    <rect x={x} y={y} width={barW} height={h} fill={color} rx={2} />
                    {shouldShowValues && !stacked && (
                      <text x={x + barW / 2} y={y - 3} textAnchor="middle" fill={t.text.secondary} fontSize={8}>
                        {fmt(val)}
                      </text>
                    )}
                  </g>
                );
              })}
              {shouldShowValues && stacked && (
                <text
                  x={groupX + (barW * series.length) / 2}
                  y={(stackY ?? height - 30) - 3}
                  textAnchor="middle"
                  fill={t.text.secondary}
                  fontSize={8}
                >
                  {fmt(series.reduce((sum, s) => sum + (s.data[ci] ?? 0), 0))}
                </text>
              )}
              <text x={groupX + (barW * series.length) / 2} y={height - 28} textAnchor="middle" fill={t.text.tertiary} fontSize={9}>
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
      <Row gap={12} wrap>
        {series.map((s, i) => (
          <Row key={s.name} gap={4} align="center">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.tone ? toneColors[s.tone] : chartColors[i % chartColors.length] }} />
            <span>{s.name}</span>
          </Row>
        ))}
      </Row>
    </div>
  );
}

type Color = keyof typeof category;

export function UsageBar({
  segments,
  total,
  topLeftLabel,
  topRightLabel,
}: {
  segments: Array<{ id: string; value: number; color?: Color }>;
  total: number;
  topLeftLabel?: ReactNode;
  topRightLabel?: ReactNode;
}) {
  const t = useHostTheme();
  const sum = segments.reduce((a, s) => a + s.value, 0);
  return (
    <Stack gap={4}>
      {(topLeftLabel || topRightLabel) && (
        <Row justify="space-between">
          <span style={{ fontSize: 12, color: t.text.tertiary }}>{topLeftLabel}</span>
          <span style={{ fontSize: 12, color: t.text.tertiary }}>{topRightLabel}</span>
        </Row>
      )}
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: t.fill.secondary }}>
        {segments.map((s, i) => (
          <div
            key={s.id}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color ? category[s.color] : chartColors[i % chartColors.length],
            }}
          />
        ))}
        {sum < total && (
          <div style={{ flex: 1, background: t.fill.quaternary }} />
        )}
      </div>
    </Stack>
  );
}

// Re-export ThemeProvider wrapper for main.tsx
export function CanvasRoot({ children }: { children: ReactNode }): JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}
