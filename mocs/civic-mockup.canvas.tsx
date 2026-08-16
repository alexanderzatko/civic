import { type CSSProperties, type PointerEvent, type ReactNode, useCallback, useRef, useState } from "react";
import {
  useCanvasState,
  useHostTheme,
  H1,
  H2,
  H3,
  Text,
  Stack,
  Row,
  Grid,
  Spacer,
  Card,
  CardHeader,
  CardBody,
  Button,
  Pill,
  Stat,
  Callout,
  Link,
  BarChart,
  Table,
  TextInput,
  TextArea,
  Select,
  Toggle,
  UsageBar,
} from "cursor/canvas";

/**
 * Civic — Slovak-first mockup for the v1 information architecture.
 *
 * Canonical source: civic/mocs/civic-mockup.canvas.tsx (version-controlled).
 * The IDE-detected file at ~/.cursor/projects/.../canvases/civic-mockup.canvas.tsx
 * is a symlink to the file above, so edits in either place are kept in sync.
 *
 * Auth screens (Rováš OAuth + PKCE entry points):
 * - login:    Prihlasenie — provider chooser (Google / Facebook / Rováš)
 * - register: Registracia — same providers framed for first-time users
 *
 * Main IA:
 * - Screen 0: Home (Vas prispevok spolocnosti) — logged-in + logged-out
 * - Screen 1: Earn hub (Ziskat merity)
 * - Screen 2: Receipts (Blocky) — fully built v1 path
 * - Screen 3: Charity projects (stub: hyperlinks to Rováš)
 * - Screen 4: Volunteer report (stub: form skeleton)
 * - Screen 6: Community / user lookup (stub: implemented later)
 *
 * Screen 6 sub-flow:
 * - list: search + recently viewed profiles
 * - profile: public user contribution dashboard (from username click)
 *
 * Screen 2 sub-flows (split claims mock):
 * - history: scanned / received tabs + scan CTA
 * - claim: verified receipt preview + share editor
 * - addPerson: Rováš user search + local memory picker
 */

type ScreenId = "login" | "register" | "0" | "1" | "2" | "3" | "4" | "6";

type ScreenGroup = "auth" | "ia";

const SCREENS: Array<{
  id: ScreenId;
  group: ScreenGroup;
  label: string;
  status: "Plne implementovaná" | "Naviguje" | "Stub";
  /** Optional small leading badge for the screen pill. Numeric main IA only. */
  pillNumber?: string;
}> = [
  { id: "login", group: "auth", label: "Prihlásenie", status: "Plne implementovaná" },
  { id: "register", group: "auth", label: "Registrácia", status: "Plne implementovaná" },
  { id: "0", group: "ia", label: "Domov", status: "Plne implementovaná", pillNumber: "0" },
  { id: "1", group: "ia", label: "Získať merity", status: "Naviguje", pillNumber: "1" },
  { id: "2", group: "ia", label: "Bločky", status: "Plne implementovaná", pillNumber: "2" },
  { id: "3", group: "ia", label: "Charita", status: "Stub", pillNumber: "3" },
  { id: "4", group: "ia", label: "Dobrovoľník", status: "Stub", pillNumber: "4" },
  { id: "6", group: "ia", label: "Komunita", status: "Stub", pillNumber: "6" },
];

export default function CivicMockup() {
  const [screen, setScreen] = useCanvasState<ScreenId>("civic.screen", "0");
  const [loggedIn, setLoggedIn] = useCanvasState<boolean>("civic.loggedIn", true);

  return (
    <Stack gap={24}>
      <Stack gap={6}>
        <H1>Civic — mockup obrazoviek</H1>
        <Text tone="secondary">
          Mockup informačnej architektúry v1. Kliknutím na ktorýkoľvek pill prejdete tok aplikácie. Auth obrazovky (Prihlásenie / Registrácia) spúšťajú Rováš OAuth + PKCE flow; bločky idú v1 end-to-end vrátane rozdelenia nároku na merity; komunita umožňuje otvoriť verejný profil používateľa; obrazovky 3 a 4 sú v1 navigačné stuby, ktoré odkazujú na stránky projektov v Rováši.
        </Text>
      </Stack>

      <ScreenSwitcher
        screen={screen}
        setScreen={setScreen}
        loggedIn={loggedIn}
        setLoggedIn={setLoggedIn}
      />

      <Phone>
        {screen === "login" && <ScreenLogin goto={setScreen} setLoggedIn={setLoggedIn} />}
        {screen === "register" && <ScreenRegister goto={setScreen} setLoggedIn={setLoggedIn} />}
        {screen === "0" &&
          (loggedIn ? (
            <Screen0LoggedIn goto={setScreen} />
          ) : (
            <Screen0LoggedOut goto={setScreen} />
          ))}
        {screen === "1" && <Screen1Earn goto={setScreen} />}
        {screen === "2" && <Screen2Receipts />}
        {screen === "3" && <Screen3Charity />}
        {screen === "4" && <Screen4Volunteer />}
        {screen === "6" && <Screen6Community />}
      </Phone>

      <Stack gap={8}>
        <H2>Informačná architektúra v1</H2>
        <Table
          headers={["#", "Názov", "Stav v1", "Hlavná akcia"]}
          columnAlign={["center", "left", "left", "left"]}
          rows={[
            ["L", "Prihlásenie", "Plne implementovaná", "Otvoriť Rováš authorize URL (PKCE)"],
            ["R", "Registrácia", "Plne implementovaná", "Otvoriť Rováš authorize URL (PKCE)"],
            ["0", "Ako prispievate spoločnosti?", "Plne implementovaná", "Získať merity → obrazovka 1"],
            ["1", "Získať merity", "Plne implementovaná (naviguje)", "→ obrazovky 2 / 3 / 4"],
            ["2", "Bločky", "Plne implementovaná", "Naskenovať bloček · rozdeliť merity"],
            ["3", "Charitatívne projekty", "Stub — odkazy na Rováš", "Otvoriť projekt na rovas.app"],
            ["4", "Dobrovoľnícka práca", "Stub — kostra formulára", "Odoslať (v1 deaktivované)"],
            ["6", "Komunita", "Stub — profil používateľa", "Klik na meno → profil"],
          ]}
          rowTone={["info", "info", "success", "success", "success", "warning", "warning", "warning"]}
        />
      </Stack>
    </Stack>
  );
}

function ScreenSwitcher({
  screen,
  setScreen,
  loggedIn,
  setLoggedIn,
}: {
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
}) {
  const theme = useHostTheme();
  const [, setCommunityPhase] = useCanvasState<"list" | "profile">("civic.community.phase", "list");
  return (
    <Row gap={8} align="center" wrap>
      <Text tone="tertiary" size="small">Auth:</Text>
      {SCREENS.filter((s) => s.group === "auth").map((s) => (
        <span key={s.id} style={{ display: "contents" }}>
          <Pill
            active={screen === s.id}
            onClick={() => setScreen(s.id)}
          >
            {s.label}
          </Pill>
        </span>
      ))}
      <span style={{ width: 1, height: 18, background: theme.stroke.tertiary, margin: "0 4px" }} />
      <Text tone="tertiary" size="small">v1 IA:</Text>
      {SCREENS.filter((s) => s.group === "ia").map((s) => (
        <span key={s.id} style={{ display: "contents" }}>
          <Pill
            active={screen === s.id}
            onClick={() => {
              if (s.id === "6") setCommunityPhase("list");
              setScreen(s.id);
            }}
            leadingContent={
              s.pillNumber ? (
                <Text tone="tertiary" size="small" as="span">{s.pillNumber}</Text>
              ) : undefined
            }
          >
            {s.label}
          </Pill>
        </span>
      ))}
      <Spacer />
      {screen === "0" && (
        <Row gap={6} align="center">
          <Text tone="tertiary" size="small">Stav:</Text>
          <Pill active={loggedIn} onClick={() => setLoggedIn(true)}>Prihlásený</Pill>
          <Pill active={!loggedIn} onClick={() => setLoggedIn(false)}>Neprihlásený</Pill>
        </Row>
      )}
    </Row>
  );
}

function Phone({ children }: { children: ReactNode }) {
  const t = useHostTheme();
  return (
    <Row justify="center">
      <div
        style={{
          width: 390,
          border: `1px solid ${t.stroke.primary}`,
          borderRadius: 28,
          padding: 20,
          background: t.bg.elevated,
        }}
      >
        <Stack gap={16}>
          <PhoneStatusBar />
          {children}
          <CivicRovasFooterLine />
        </Stack>
      </div>
    </Row>
  );
}

function PhoneStatusBar() {
  const t = useHostTheme();
  return (
    <Row align="center" justify="space-between" style={{ color: t.text.tertiary, fontSize: 11 }}>
      <span>Civic</span>
      <span>09:41</span>
      <span>SK</span>
    </Row>
  );
}

/**
 * ME (Merit) brand logo. Source: identity/ME_logo.svg in the civic repo —
 * cropped via tightened viewBox to remove the original 595x842 page padding.
 * Path fill is `currentColor` so the logo follows the host theme.
 */
function MeLogo({ size = 56 }: { size?: number }) {
  const t = useHostTheme();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        color: t.text.primary,
      }}
      aria-label="Logo Merit (ME)"
    >
      <svg
        viewBox="215 268 165 112"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          d="M349.92,302.97l21.67,0.79c-0.56-16.71-14.11-30.25-30.82-30.93l0.79,22.13l-6.21-2.71l0.79-19.42h-61.41l0.79,19.42l-6.21,2.71l0.79-22.13c-16.71,0.68-30.25,14.22-30.82,30.93l21.67-0.79v6.21l-21.67-0.79v34.2c0,8.58,3.39,16.37,8.92,22.13l12.53-17.27l4.85,3.95L252.04,368c5.42,4.06,12.08,6.43,19.19,6.43h26.53l-18.74-23.03l4.85-3.95l19.75,27.09h3.5l19.75-27.09l4.85,3.95L313,374.54h26.64c7.22,0,13.77-2.37,19.19-6.43l-13.55-16.71l4.85-3.95l12.53,17.27c5.53-5.76,9.03-13.55,9.03-22.13v-34.2l-21.79,0.79V302.97z M345.06,343.5l-3.39,2.71h-6.66l-3.16-2.48v-28.67l-22.58,17.16l-3.84-0.11l-3.84,0.11l-22.58-17.27v28.67l-3.27,2.6h-6.66l-3.27-2.71v-41.77l10.5-5.19l29.01,22.13l29.12-22.13l10.5,5.19L345.06,343.5L345.06,343.5z"
        />
      </svg>
    </div>
  );
}

function ScreenTitle({
  sk,
  icon,
  centered,
}: {
  sk: string;
  icon?: ReactNode;
  centered?: boolean;
}) {
  if (centered) {
    return <H2 style={{ textAlign: "center" }}>{sk}</H2>;
  }
  if (icon) {
    return (
      <Row align="center" gap={10}>
        {icon}
        <H2>{sk}</H2>
      </Row>
    );
  }
  return <H2>{sk}</H2>;
}

/**
 * Stylised QR code glyph (three finder patterns + scattered data dots).
 * Pure black-on-transparent — fill follows currentColor.
 */
function QrCodeIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 2h10v10H2V2zm2 2v6h6V4H4z" />
      <rect x="5" y="5" width="4" height="4" />
      <path d="M20 2h10v10H20V2zm2 2v6h6V4h-6z" />
      <rect x="23" y="5" width="4" height="4" />
      <path d="M2 20h10v10H2V20zm2 2v6h6v-6H4z" />
      <rect x="5" y="23" width="4" height="4" />
      <rect x="14" y="2" width="2" height="2" />
      <rect x="14" y="6" width="2" height="2" />
      <rect x="16" y="10" width="2" height="2" />
      <rect x="14" y="14" width="2" height="2" />
      <rect x="20" y="14" width="2" height="2" />
      <rect x="22" y="16" width="2" height="2" />
      <rect x="26" y="14" width="2" height="2" />
      <rect x="14" y="20" width="2" height="2" />
      <rect x="18" y="22" width="2" height="2" />
      <rect x="22" y="22" width="2" height="2" />
      <rect x="26" y="22" width="2" height="2" />
      <rect x="14" y="26" width="2" height="2" />
      <rect x="20" y="26" width="2" height="2" />
      <rect x="24" y="28" width="2" height="2" />
    </svg>
  );
}

/**
 * Clipboard with form lines — pictogram for "fill out a report".
 * Drawn with evenodd fill so the document outline reads as a frame.
 */
function ReportIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="12" y="3" width="8" height="4" rx="1" />
      <path d="M6 5h6v2h8V5h6v23H6V5z M8 7v19h16V7h-4v2H12V7H8z" />
      <rect x="11" y="13" width="10" height="2" />
      <rect x="11" y="17" width="10" height="2" />
      <rect x="11" y="21" width="7" height="2" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function SquareActionButton({
  icon,
  ariaLabel,
  onClick,
}: {
  icon: ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}) {
  const t = useHostTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 48,
        padding: 5,
        background: t.fill.tertiary,
        color: t.text.primary,
        border: `1px solid ${t.stroke.primary}`,
        borderRadius: 9,
        cursor: "pointer",
      }}
    >
      {icon}
    </button>
  );
}

function CivicRovasFooterLine() {
  return (
    <Text tone="tertiary" size="small" style={{ textAlign: "center" }}>
      Civic a Rováš sú aplikácie{" "}
      <Link href="https://neofund.sk">NeoFund n.f.</Link>
    </Text>
  );
}

function HomeFooter() {
  return (
    <Stack gap={2} style={{ alignItems: "center" }}>
      <Text tone="tertiary" size="small">
        * ME = Merit · ekonomická hodnota odovzdaná spoločnosti
      </Text>
      <Text tone="tertiary" size="small">
        10 ME = 1 hodina práce
      </Text>
      <Text tone="tertiary" size="small">
        € ekvivalent: 1 hodina ≈ priemerná hodinová mzda v krajine
      </Text>
    </Stack>
  );
}

function ChronFooter() {
  return (
    <Stack gap={2} style={{ alignItems: "center" }}>
      <Text tone="tertiary" size="small">
        * CHR = Chron · interná evidencia overenej práce
      </Text>
      <Text tone="tertiary" size="small">
        10 CHR = 1 hodina práce
      </Text>
      <Text tone="tertiary" size="small" style={{ textAlign: "center" }}>
        Chrony môžete vymeniť aj za Merity alebo získať nimi benefity ponúkané niektorými projektmi.
      </Text>
    </Stack>
  );
}

function HomeQuickActions({ goto }: { goto: (s: ScreenId) => void }) {
  return (
    <Row justify="center" gap={80}>
      <SquareActionButton
        icon={<QrCodeIcon size={36} />}
        ariaLabel="Naskenovať bloček"
        onClick={() => goto("2")}
      />
      <SquareActionButton
        icon={<ReportIcon size={36} />}
        ariaLabel="Reportovať dobrovoľnícku prácu"
        onClick={() => goto("4")}
      />
    </Row>
  );
}

type AuthProvider = "google" | "facebook" | "rovas";

const PROVIDER_GLYPH: Record<AuthProvider, string> = {
  google: "G",
  facebook: "f",
  rovas: "R",
};

const PROVIDER_LABEL_LOGIN: Record<AuthProvider, string> = {
  google: "Pokračovať s Google",
  facebook: "Pokračovať s Facebook",
  rovas: "Prihlásiť sa s Rováš účtom",
};

const PROVIDER_LABEL_REGISTER: Record<AuthProvider, string> = {
  google: "Vytvoriť účet cez Google",
  facebook: "Vytvoriť účet cez Facebook",
  rovas: "Vytvoriť nový Rováš účet",
};

function ProviderButton({
  provider,
  label,
  onClick,
}: {
  provider: AuthProvider;
  label: string;
  onClick: () => void;
}) {
  const t = useHostTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        height: 40,
        paddingLeft: 14,
        paddingRight: 14,
        background: t.fill.tertiary,
        color: t.text.primary,
        border: `1px solid ${t.stroke.primary}`,
        borderRadius: 8,
        font: "inherit",
        fontSize: 14,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 4,
          background: t.fill.primary,
          color: t.text.primary,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {PROVIDER_GLYPH[provider]}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function ScreenLogin({
  goto,
  setLoggedIn,
}: {
  goto: (s: ScreenId) => void;
  setLoggedIn: (v: boolean) => void;
}) {
  const t = useHostTheme();
  const signIn = (_provider: AuthProvider) => {
    setLoggedIn(true);
    goto("0");
  };
  return (
    <Stack gap={18}>
      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo size={48} />
        <ScreenTitle sk="Prihláste sa" />
      </Stack>

      <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
        Vyberte spôsob prihlásenia. Vaša identita v Civic je váš Rováš účet.
      </Text>

      <Stack gap={8}>
        <ProviderButton provider="google" label={PROVIDER_LABEL_LOGIN.google} onClick={() => signIn("google")} />
        <ProviderButton provider="facebook" label={PROVIDER_LABEL_LOGIN.facebook} onClick={() => signIn("facebook")} />
        <ProviderButton provider="rovas" label={PROVIDER_LABEL_LOGIN.rovas} onClick={() => signIn("rovas")} />
      </Stack>

      <Row align="center" gap={8}>
        <div style={{ flex: 1, height: 1, background: t.stroke.tertiary }} />
        <Text tone="tertiary" size="small">alebo</Text>
        <div style={{ flex: 1, height: 1, background: t.stroke.tertiary }} />
      </Row>

      <Row justify="center">
        <Text size="small">
          Nemáte účet?{" "}
          <span
            onClick={() => goto("register")}
            style={{ color: t.text.link, cursor: "pointer", fontWeight: 600 }}
          >
            Zaregistrujte sa →
          </span>
        </Text>
      </Row>

      <Callout tone="info">
        <Text size="small">
          Po kliknutí sa otvorí systémový prehliadač a presmeruje vás na Rováš (PKCE Authorization Code).
          Civic neuchováva vaše heslo — len krátkodobý prístupový token.
        </Text>
      </Callout>

      <Text tone="tertiary" size="small" style={{ textAlign: "center" }}>
        Pokračovaním súhlasíte s{" "}
        <Link href="https://civic.example.sk/terms">podmienkami</Link>
        {" a "}
        <Link href="https://civic.example.sk/privacy">ochranou osobných údajov</Link>.
      </Text>
    </Stack>
  );
}

function ScreenRegister({
  goto,
  setLoggedIn,
}: {
  goto: (s: ScreenId) => void;
  setLoggedIn: (v: boolean) => void;
}) {
  const t = useHostTheme();
  const signUp = (_provider: AuthProvider) => {
    setLoggedIn(true);
    goto("0");
  };
  return (
    <Stack gap={18}>
      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo size={48} />
        <ScreenTitle sk="Vytvorte si účet" />
      </Stack>

      <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
        Civic vám umižňuje sledovať váš príspevok spoločnosti cez dane, charitu alebo
        dobrovoľníctvo, na jednom mieste.
      </Text>

      <Callout tone="info" title="Civic a Rováš">
        <Text size="small">
          Civic je mobilná aplikácia; váš účet a merity (ME) žijú na{" "}
          <Link href="https://rovas.app">Rováši</Link>. Pri registrácii sa prihlásite alebo
          vytvoríte Rováš účet — samostatný účet Civic neexistuje.
        </Text>
      </Callout>

      <Stack gap={8}>
        <ProviderButton provider="google" label={PROVIDER_LABEL_REGISTER.google} onClick={() => signUp("google")} />
        <ProviderButton provider="facebook" label={PROVIDER_LABEL_REGISTER.facebook} onClick={() => signUp("facebook")} />
        <ProviderButton provider="rovas" label={PROVIDER_LABEL_REGISTER.rovas} onClick={() => signUp("rovas")} />
      </Stack>

      <Callout tone="info" title="Automatické prepojenie s Rovášom">
        <Text size="small">
          Pri prihlásení cez Google alebo Facebook sa váš Rováš účet vytvorí automaticky.
        </Text>
      </Callout>

      <Row align="center" gap={8}>
        <div style={{ flex: 1, height: 1, background: t.stroke.tertiary }} />
        <Text tone="tertiary" size="small">alebo</Text>
        <div style={{ flex: 1, height: 1, background: t.stroke.tertiary }} />
      </Row>

      <Row justify="center">
        <Text size="small">
          Už máte účet?{" "}
          <span
            onClick={() => goto("login")}
            style={{ color: t.text.link, cursor: "pointer", fontWeight: 600 }}
          >
            Prihláste sa →
          </span>
        </Text>
      </Row>

      <Text tone="tertiary" size="small" style={{ textAlign: "center" }}>
        Vytvorením účtu súhlasíte s{" "}
        <Link href="https://civic.example.sk/terms">podmienkami</Link>
        {" a "}
        <Link href="https://civic.example.sk/privacy">ochranou osobných údajov</Link>.
      </Text>
    </Stack>
  );
}

function Screen0LoggedIn({ goto }: { goto: (s: ScreenId) => void }) {
  const t = useHostTheme();
  const [, setCommunityPhase] = useCanvasState<"list" | "profile">("civic.community.phase", "list");
  const headlineStyle: CSSProperties = {
    fontSize: 40,
    fontWeight: 600,
    color: t.accent.primary,
    lineHeight: 1.1,
  };
  return (
    <Stack gap={18}>
      <ScreenTitle sk="Ako prispievate spoločnosti?" centered />

      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo />
        <div style={headlineStyle}>1 248 ME</div>
        <Text tone="secondary" size="small">~ 975 €</Text>
      </Stack>

      <CommunityPositionPanel
        userMe={1248}
        bucketIndex={USER_BUCKET_INDEX}
        labelPrefix="Vy"
        onCommunityLink={() => {
          setCommunityPhase("list");
          goto("6");
        }}
      />

      <Row justify="center">
        <Button
          variant="primary"
          onClick={() => goto("1")}
          style={{
            height: 48,
            paddingLeft: 24,
            paddingRight: 24,
            fontSize: 18,
            fontWeight: 600,
            borderRadius: 12,
          }}
        >
          Získať merity
        </Button>
      </Row>

      <HomeQuickActions goto={goto} />
    </Stack>
  );
}

/**
 * Log-scale Merit balance buckets — mirrors the Rováš Merit Distribution module.
 * Used for the expandable histogram and percentile ↔ ME mapping on the ladder.
 */
const RANK_BUCKET_COUNTS = [5, 19, 48, 104, 93, 23, 5, 1];
const RANK_BUCKET_BOUNDS: Array<[number, number]> = [
  [0, 0.1],
  [0.1, 1],
  [1, 10],
  [10, 100],
  [100, 1000],
  [1000, 10000],
  [10000, 100000],
  [100000, 1_000_000],
];
const RANK_TOTAL_USERS = RANK_BUCKET_COUNTS.reduce((sum, count) => sum + count, 0);
const USER_BUCKET_INDEX = 5;

function formatMeritBound(n: number): string {
  if (n === 0) return "0";
  if (n < 1) return n.toLocaleString("sk-SK", { maximumFractionDigits: 1 });
  if (n >= 1000) return Math.round(n).toLocaleString("sk-SK");
  return n < 10 && n !== Math.round(n)
    ? n.toLocaleString("sk-SK", { maximumFractionDigits: 1 })
    : Math.round(n).toLocaleString("sk-SK");
}

function rankBucketLabelSpelled(index: number): string {
  const [lo, hi] = RANK_BUCKET_BOUNDS[index];
  const isLast = index === RANK_BUCKET_BOUNDS.length - 1;
  if (lo === 0) return `menej ako ${formatMeritBound(hi)} meritov`;
  if (isLast) return `${formatMeritBound(lo)}+ meritov`;
  return `${formatMeritBound(lo)} – ${formatMeritBound(hi)} meritov`;
}

function logBucketFraction(me: number, lo: number, hi: number): number {
  const logLo = Math.log10(Math.max(lo, 0.01));
  const logHi = Math.log10(hi);
  const logMe = Math.log10(Math.max(me, 0.01));
  if (logHi === logLo) return 0.5;
  return Math.min(1, Math.max(0, (logMe - logLo) / (logHi - logLo)));
}

function meToSliderPosition(me: number): number {
  if (me <= 0) return 0;
  const n = RANK_BUCKET_COUNTS.length;
  for (let i = 0; i < n; i++) {
    const [lo, hi] = RANK_BUCKET_BOUNDS[i];
    if (me < lo) return (i / n) * 100;
    if (me <= hi || i === n - 1) {
      const frac = logBucketFraction(me, lo, hi);
      return ((i + frac) / n) * 100;
    }
  }
  return 100;
}

function sliderPositionToBucketIndex(sliderPct: number): number {
  const n = RANK_BUCKET_COUNTS.length;
  const clamped = Math.min(100, Math.max(0, sliderPct));
  if (clamped >= 100) return n - 1;
  return Math.min(n - 1, Math.floor((clamped / 100) * n));
}

function meToPercentile(me: number): number {
  if (me <= 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < RANK_BUCKET_COUNTS.length; i++) {
    const [lo, hi] = RANK_BUCKET_BOUNDS[i];
    const count = RANK_BUCKET_COUNTS[i];
    if (me < lo) {
      return (cumulative / RANK_TOTAL_USERS) * 100;
    }
    if (me <= hi || i === RANK_BUCKET_COUNTS.length - 1) {
      const frac = logBucketFraction(me, lo, hi);
      return ((cumulative + frac * count) / RANK_TOTAL_USERS) * 100;
    }
    cumulative += count;
  }
  return 100;
}

/** Headline for logged-in users based on community percentile (0 = lowest, 100 = highest). */
function RankPositionHeadline({
  percentile,
  onCommunityLink,
}: {
  percentile: number;
  onCommunityLink?: () => void;
}) {
  const t = useHostTheme();
  const linkWord = (word: string) =>
    onCommunityLink ? (
      <span
        onClick={onCommunityLink}
        style={{ color: t.text.link, cursor: "pointer", textDecoration: "underline" }}
      >
        {word}
      </span>
    ) : (
      word
    );

  const p = percentile / 100;
  if (p < 0.25) {
    return <>Začínate svoju cestu — každý príspevok sa počíta.</>;
  }
  if (p < 1 / 3) {
    return <>Ste medzi štvrťinou {linkWord("prispievateľov")} s nižším príspevkom.</>;
  }
  if (p < 0.5) {
    return <>Budujete si miesto v {linkWord("komunite")} — zatiaľ v dolnej polovici.</>;
  }
  if (p < 2 / 3) {
    return <>Ste v strede {linkWord("komunity")}.</>;
  }
  if (p < 0.75) {
    return <>Ste nadpriemerným {linkWord("prispievateľom")}.</>;
  }
  return <>Patríte medzi najaktívnejších {linkWord("prispievateľov")}.</>;
}

function RankLadder({
  userPercentile,
  onDragStateChange,
}: {
  userPercentile: number;
  onDragStateChange?: (state: { dragging: boolean; probePct: number }) => void;
}) {
  const t = useHostTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const [probePct, setProbePct] = useState(userPercentile);
  const [dragging, setDragging] = useState(false);

  const pctFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return userPercentile;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  }, [userPercentile]);

  const emitDragState = (nextDragging: boolean, nextProbePct: number) => {
    onDragStateChange?.({ dragging: nextDragging, probePct: nextProbePct });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pct = pctFromClientX(e.clientX);
    setDragging(true);
    setProbePct(pct);
    emitDragState(true, pct);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const pct = pctFromClientX(e.clientX);
    setProbePct(pct);
    emitDragState(true, pct);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    setProbePct(userPercentile);
    emitDragState(false, userPercentile);
  };

  const probeBucketIndex = sliderPositionToBucketIndex(probePct);
  const trackHeight = 8;
  const markerSize = 14;

  function markerStyle(pct: number, accent: boolean): CSSProperties {
    return {
      position: "absolute",
      left: `${pct}%`,
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: markerSize,
      height: markerSize,
      borderRadius: markerSize / 2,
      background: accent ? t.accent.primary : t.fill.secondary,
      border: `2px solid ${accent ? t.accent.primary : t.stroke.primary}`,
      boxSizing: "border-box",
      zIndex: accent ? 2 : 1,
    };
  }

  return (
    <Stack gap={4}>
      <div style={{ position: "relative", paddingBottom: 8, touchAction: "none" }}>
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(probePct)}
          aria-label="Porovnanie príspevku v komunite"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "relative",
            height: trackHeight,
            borderRadius: trackHeight / 2,
            background: t.fill.secondary,
            cursor: "grab",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${userPercentile}%`,
              borderRadius: trackHeight / 2,
              background: t.fill.tertiary,
            }}
          />
          <div style={markerStyle(userPercentile, false)} aria-hidden />
          <div
            style={{
              ...markerStyle(probePct, true),
              cursor: dragging ? "grabbing" : "grab",
              zIndex: 3,
            }}
            aria-hidden
          />
        </div>
        <Row justify="space-between" style={{ marginTop: 6 }}>
          <Text tone="tertiary" size="small">0</Text>
          <Text tone="tertiary" size="small">100 %</Text>
        </Row>
      </div>
      {dragging && (
        <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
          Ľudí v tomto intervale:{" "}
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: t.accent.primary,
            }}
          >
            {RANK_BUCKET_COUNTS[probeBucketIndex].toLocaleString("sk-SK")}
          </span>
        </Text>
      )}
    </Stack>
  );
}

function RankDistributionDetail({ highlightIndex }: { highlightIndex: number }) {
  const t = useHostTheme();
  const pct = RANK_BUCKET_COUNTS.map((count) =>
    Math.round((count / RANK_TOTAL_USERS) * 1000) / 10,
  );
  const bucketLabel = rankBucketLabelSpelled(highlightIndex);
  const maxPct = Math.max(...pct, 1);

  return (
    <Stack gap={8}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height: 120,
        }}
      >
        {pct.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "100%",
                height: `${(v / maxPct) * 100}%`,
                minHeight: v > 0 ? 3 : 0,
                borderRadius: 2,
                background:
                  i === highlightIndex ? t.accent.primary : t.fill.secondary,
              }}
            />
          </div>
        ))}
      </div>
      <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
        {bucketLabel}
      </Text>
    </Stack>
  );
}

function CommunityPositionPanel({
  userMe,
  bucketIndex,
  username = "sano",
  labelPrefix,
  onCommunityLink,
}: {
  userMe: number;
  bucketIndex: number;
  username?: string;
  labelPrefix?: string;
  onCommunityLink?: () => void;
}) {
  const [dragState, setDragState] = useState({ dragging: false, probePct: 0 });
  const percentile = meToPercentile(userMe);
  const sliderPos = meToSliderPosition(userMe);

  return (
    <Card>
      <CardBody>
        <Stack gap={12}>
          <H3 style={{ textAlign: "center", margin: 0 }}>
            <RankPositionHeadline percentile={percentile} onCommunityLink={onCommunityLink} />
          </H3>

          <Text size="small" tone="secondary" style={{ textAlign: "center" }}>
            Kde ste v porovnaní s ostatnými
          </Text>

          <RankLadder
            userPercentile={sliderPos}
            onDragStateChange={setDragState}
          />

          {dragState.dragging && (
            <RankDistributionDetail
              highlightIndex={sliderPositionToBucketIndex(dragState.probePct)}
            />
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}

function CommunityAggregatePanel({ goto }: { goto: (s: ScreenId) => void }) {
  return (
    <Stack gap={12} style={{ alignItems: "center" }}>
      <Text weight="semibold" style={{ textAlign: "center", fontSize: 15 }}>
        Celková hodnota registrovaných príspevkov
      </Text>
      <Text size="small" weight="semibold" style={{ textAlign: "center" }}>
        Prihláste sa alebo sa zaregistrujte a zistite svoj príspevok
      </Text>
      <Row justify="center" gap={8}>
        <Button variant="primary" onClick={() => goto("login")}>
          Prihláste sa
        </Button>
        <Button variant="ghost" onClick={() => goto("register")}>
          Registrácia
        </Button>
      </Row>
    </Stack>
  );
}

function Screen0LoggedOut({ goto }: { goto: (s: ScreenId) => void }) {
  const t = useHostTheme();
  const subStyle: CSSProperties = {
    fontSize: 24,
    fontWeight: 600,
    color: t.text.primary,
    lineHeight: 1.1,
  };
  return (
    <Stack gap={18}>
      <ScreenTitle sk="Ako prispievate spoločnosti?" centered />

      <Text tone="secondary" size="small" style={{ textAlign: "center", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600 }}>Civic</span>
        {" zobrazuje príspevok ľudí spoločnosti v "}
        <span style={{ fontWeight: 600 }}>meritoch (ME)*</span>
        {" — jednotkách ekonomickej hodnoty odovzdanej cez dane, charitu alebo dobrovoľníctvo."}
      </Text>

      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo size={48} />
      </Stack>

      <Stack gap={4} style={{ alignItems: "center" }}>
        <div style={subStyle}>84 320 ME</div>
        <Text tone="secondary" size="small">~ 65 770 €</Text>
      </Stack>

      <CommunityAggregatePanel goto={goto} />

      <HomeFooter />
    </Stack>
  );
}

function Screen1Earn({ goto }: { goto: (s: ScreenId) => void }) {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Získať merity" />

      <Text tone="secondary" size="small">
        Nárok na zisk meritov máte vždy keď odovzdáte ekonomickú hodnotu spoločnosti.
        Tu sú tri hlavné možnosti:
      </Text>

      <Card>
        <CardHeader trailing={<Pill size="sm">1</Pill>}>Dane</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text size="small">
              Zaregistrujte nákupné bločky a získajte merity za účtovanú DPH
            </Text>
            <Row justify="end">
              <Button variant="primary" onClick={() => goto("2")}>
                Naskenovať bloček
              </Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">2</Pill>}>Charita</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text size="small">
              Získajte merity za príspevok charite podľa svojho výberu
            </Text>
            <Row justify="end">
              <Button variant="secondary" onClick={() => goto("3")}>
                Vybrať charitu
              </Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">3</Pill>}>Dobrovoľníctvo</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text size="small">Reportujte svoju dobrovoľnícku prácu</Text>
            <Row justify="end">
              <Button variant="secondary" onClick={() => goto("4")}>
                Nahlásiť prácu
              </Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function Screen2Receipts() {
  const [phase, setPhase] = useCanvasState<"history" | "claim" | "addPerson">(
    "civic.receipts.phase",
    "history",
  );
  const [historyTab, setHistoryTab] = useCanvasState<"scanned" | "received">(
    "civic.receipts.historyTab",
    "scanned",
  );

  if (phase === "claim") {
    return (
      <ReceiptClaimFlow
        onBack={() => setPhase("history")}
        onAddPerson={() => setPhase("addPerson")}
      />
    );
  }

  if (phase === "addPerson") {
    return <ReceiptAddRecipient onBack={() => setPhase("claim")} />;
  }

  return (
    <Stack gap={16}>
      <ScreenTitle sk="Bločky" icon={<QrCodeIcon size={24} />} />

      <Row justify="center">
        <Button variant="primary" onClick={() => setPhase("claim")}>
          Naskenovať nový bloček
        </Button>
      </Row>

      <Row gap={8} wrap>
        <Pill active={historyTab === "received"} onClick={() => setHistoryTab("received")}>
          Moje merity z bločkov
        </Pill>
        <Pill active={historyTab === "scanned"} onClick={() => setHistoryTab("scanned")}>
          Moje naskenované bločky
        </Pill>
      </Row>

      {historyTab === "scanned" ? (
        <>
          <Stack gap={4}>
            <H3>Naskenované bločky</H3>
            <Text tone="tertiary" size="small">DPH overená Finančnou správou</Text>
          </Stack>

          <Table
            headers={["Dátum", "Predajca", "DPH €", "ME"]}
            columnAlign={["left", "left", "right", "right"]}
            rows={[
              ["11.6.2026", "Tesco Bratislava", "4,82", "6,42"],
              ["8.6.2026", "Lidl Petržalka", "2,19", "2,91"],
              ["4.6.2026", "Kaufland Trnava", "7,40", "9,85"],
              ["1.6.2026", "Billa Žilina", "1,05", "1,40"],
              ["28.5.2026", "Slovnaft Nitra", "12,30", "16,38"],
            ]}
            rowTone={["success", "success", "success", "success", "success"]}
          />
        </>
      ) : (
        <>
          <Stack gap={4}>
            <H3>Prijaté merity z cudzích bločkov</H3>
            <Text tone="tertiary" size="small">Podiel, ktorý vám niekto pridelil pri nároku</Text>
          </Stack>

          <Table
            headers={["Dátum", "Predajca", "Od", "Podiel", "ME"]}
            columnAlign={["left", "left", "left", "right", "right"]}
            rows={[
              ["9.6.2026", "Tesco Bratislava", "@sano", "50 %", "3,21"],
              ["2.6.2026", "DM Drogerie BA", "@milan.k", "33 %", "1,84"],
              ["18.5.2026", "Kaufland Trnava", "@sano", "50 %", "4,93"],
            ]}
            rowTone={["success", "success", "success"]}
          />
        </>
      )}

      <Callout tone="info">
        <Text size="small">
          Po naskenovaní bločka Civic overí jeho registráciu u Finančnej správy, zo zaplatenej DPH vypočíta získané merity.
        </Text>
      </Callout>
    </Stack>
  );
}

type SplitRecipient = {
  username: string;
  displayName: string;
  sharePct: number;
  isScanner: boolean;
  alwaysShare: boolean;
};

const MOCK_RECEIPT = {
  merchant: "Tesco Bratislava",
  date: "30.6.2026",
  vatEur: "4,82",
  totalMe: 6.67,
};

/** Whole ME — home and user profile headline totals only. */
function formatMeWhole(n: number): string {
  return Math.round(n).toLocaleString("sk-SK");
}

/** ME with 2 decimal places — receipts, splits, breakdowns, and tables. */
function formatMeDecimal(n: number): string {
  return n.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function floorMeShare(totalMe: number, sharePct: number): number {
  return Math.floor(((totalMe * sharePct) / 100) * 100) / 100;
}

const MOCK_SEARCH_RESULTS: Array<{ username: string; displayName: string }> = [
  { username: "anna_nb", displayName: "Anna Nováková" },
  { username: "milan.k", displayName: "Milan Kováč" },
];

const MOCK_MEMORY: Array<{ username: string; displayName: string; alwaysShare: boolean }> = [
  { username: "anna_nb", displayName: "Anna Nováková", alwaysShare: true },
  { username: "milan.k", displayName: "Milan Kováč", alwaysShare: false },
];

const DEFAULT_SPLIT_RECIPIENTS: SplitRecipient[] = [
  { username: "sano", displayName: "Vy (sano)", sharePct: 50, isScanner: true, alwaysShare: false },
  { username: "anna_nb", displayName: "Anna Nováková", sharePct: 50, isScanner: false, alwaysShare: true },
];

function meritsForRecipients(
  totalMe: number,
  recipients: SplitRecipient[],
): Record<string, number> {
  const result: Record<string, number> = {};
  let assigned = 0;
  for (const r of recipients) {
    if (!r.isScanner) {
      const me = floorMeShare(totalMe, r.sharePct);
      result[r.username] = me;
      assigned += me;
    }
  }
  const scanner = recipients.find((r) => r.isScanner);
  if (scanner) {
    result[scanner.username] = Math.round((totalMe - assigned) * 100) / 100;
  }
  return result;
}

function ReceiptClaimFlow({
  onBack,
  onAddPerson,
}: {
  onBack: () => void;
  onAddPerson: () => void;
}) {
  const t = useHostTheme();
  const [recipients, setRecipients] = useCanvasState<SplitRecipient[]>(
    "civic.receipts.splitRecipients",
    DEFAULT_SPLIT_RECIPIENTS,
  );

  const shareSum = recipients.reduce((sum, r) => sum + r.sharePct, 0);
  const meritByUser = meritsForRecipients(MOCK_RECEIPT.totalMe, recipients);
  const scanner = recipients.find((r) => r.isScanner);
  const roundingResidue =
    scanner !== undefined
      ? Math.round(
          (meritByUser[scanner.username] - floorMeShare(MOCK_RECEIPT.totalMe, scanner.sharePct)) *
            100,
        ) / 100
      : 0;

  function updateShare(username: string, sharePct: number) {
    setRecipients(
      recipients.map((r) => (r.username === username ? { ...r, sharePct } : r)),
    );
  }

  function removeRecipient(username: string) {
    const next = recipients.filter((r) => r.username !== username);
    const equal = Math.round(10000 / next.length) / 100;
    setRecipients(next.map((r) => ({ ...r, sharePct: equal })));
  }

  return (
    <Stack gap={14}>
      <Row align="center" gap={8}>
        <Button variant="ghost" onClick={onBack}>
          ← Späť
        </Button>
        <Spacer />
        <Pill size="sm">Overené FS</Pill>
      </Row>

      <ScreenTitle sk="Príjemcovia meritov" icon={<QrCodeIcon size={24} />} />

      <Card>
        <CardHeader trailing={<Pill size="sm">{MOCK_RECEIPT.date}</Pill>}>
          {MOCK_RECEIPT.merchant}
        </CardHeader>
        <CardBody>
          <Row gap={16} wrap>
            <Stat value={`${MOCK_RECEIPT.vatEur} €`} label="DPH" />
            <Stat value={`${formatMeDecimal(MOCK_RECEIPT.totalMe)} ME`} label="Celkom" />
          </Row>
        </CardBody>
      </Card>

      <Stack gap={6}>
        <Row align="center" gap={8}>
          <H3>Podielnici</H3>
          <Spacer />
          <Button variant="secondary" onClick={onAddPerson}>
            + Pridať osobu
          </Button>
        </Row>
      </Stack>

      <Stack gap={8}>
        {recipients.map((r) => (
          <Card key={r.username}>
            <CardBody>
              <div style={{ position: "relative" }}>
                <Stack gap={8}>
                  <Row align="center" gap={8} wrap>
                    <Stack gap={2} style={{ flex: 1, minWidth: 120 }}>
                      <Text size="small" weight="semibold">{r.displayName}</Text>
                      <Text tone="tertiary" size="small">@{r.username}</Text>
                    </Stack>
                    <TextInput
                      value={String(r.sharePct)}
                      onChange={(v) => updateShare(r.username, Number(v.replace(",", ".")) || 0)}
                      style={{ width: 56, textAlign: "right" }}
                    />
                    <Text size="small" tone="tertiary">%</Text>
                    <Text size="small" weight="semibold" style={{ minWidth: 56, textAlign: "right" }}>
                      {formatMeDecimal(meritByUser[r.username])} ME
                    </Text>
                  </Row>
                  {!r.isScanner && (
                    <Row align="center" gap={8}>
                      <Toggle
                        checked={r.alwaysShare}
                        onChange={(v) =>
                          setRecipients(
                            recipients.map((x) =>
                              x.username === r.username ? { ...x, alwaysShare: v } : x,
                            ),
                          )
                        }
                      />
                      <Text size="small" tone="secondary">Vždy zdieľať pre nové bločky</Text>
                    </Row>
                  )}
                </Stack>
                {!r.isScanner && (
                  <button
                    type="button"
                    onClick={() => removeRecipient(r.username)}
                    aria-label="Odstrániť"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      padding: 0,
                      background: "transparent",
                      color: t.text.tertiary,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </Stack>

      <Row align="center" gap={8}>
        <Text size="small" tone="secondary" weight={shareSum !== 100 ? "semibold" : "regular"}>
          Súčet podielov: {shareSum.toFixed(0)} %
        </Text>
        <Spacer />
        <Button variant="primary" disabled={shareSum !== 100}>
          Potvrdiť
        </Button>
      </Row>

      <Callout tone="info">
        <Text size="small">
          Zaokrúhľovací zvyšok ide skenerovi
          {roundingResidue > 0 && scanner
            ? ` — tu ${formatMeDecimal(roundingResidue)} ME navyše pre @${scanner.username}, aby súčet presne sedel s ${formatMeDecimal(MOCK_RECEIPT.totalMe)} ME.`
            : `, aby súčet presne sedel s ${formatMeDecimal(MOCK_RECEIPT.totalMe)} ME.`}
        </Text>
      </Callout>
    </Stack>
  );
}

function ReceiptAddRecipient({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useCanvasState<string>("civic.receipts.searchQuery", "");
  const [memory, setMemory] = useCanvasState<typeof MOCK_MEMORY>(
    "civic.receipts.memory",
    MOCK_MEMORY,
  );

  const results =
    query.trim().length >= 3
      ? MOCK_SEARCH_RESULTS.filter(
          (r) =>
            r.username.includes(query.toLowerCase()) ||
            r.displayName.toLowerCase().includes(query.toLowerCase()),
        )
      : [];

  return (
    <Stack gap={14}>
      <Row align="center" gap={8}>
        <Button variant="ghost" onClick={onBack}>
          ← Späť
        </Button>
      </Row>

      <ScreenTitle sk="Pridať príjemcu" />

      <FormField label="Vyhľadať Rováš používateľa">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Min. 3 znaky — napr. ann"
        />
      </FormField>

      {results.length > 0 && (
        <Stack gap={8}>
          <Text size="small" weight="semibold">Výsledky vyhľadávania</Text>
          {results.map((r) => (
            <Card key={r.username}>
              <CardBody>
                <Row align="center" gap={8}>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="small" weight="semibold">{r.displayName}</Text>
                    <Text tone="tertiary" size="small">@{r.username}</Text>
                  </Stack>
                  <Button variant="secondary" onClick={onBack}>
                    Pridať
                  </Button>
                </Row>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}

      <Stack gap={8}>
        <Text size="small" weight="semibold">Predtým zdieľaní (lokálna pamäť)</Text>
        {memory.map((entry) => (
          <Card key={entry.username}>
            <CardBody>
              <Stack gap={8}>
                <Row align="center" gap={8}>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="small" weight="semibold">{entry.displayName}</Text>
                    <Text tone="tertiary" size="small">@{entry.username}</Text>
                  </Stack>
                  <Button variant="secondary" onClick={onBack}>
                    Pridať
                  </Button>
                </Row>
                <Row align="center" gap={8}>
                  <Toggle
                    checked={entry.alwaysShare}
                    onChange={(v) =>
                      setMemory(
                        memory.map((m) =>
                          m.username === entry.username ? { ...m, alwaysShare: v } : m,
                        ),
                      )
                    }
                  />
                  <Text size="small" tone="secondary">Vždy zdieľať</Text>
                </Row>
              </Stack>
            </CardBody>
          </Card>
        ))}
      </Stack>

      <Callout tone="info">
        <Text size="small">
          Pamäť príjemcov je len v zariadení. Po pridaní sa podiely automaticky prepočítajú na rovnaké percentá.
        </Text>
      </Callout>
    </Stack>
  );
}

const ROVAS_CHARITY_PROJECTS_URL = "https://rovas.app/charity-projects";
const ROVAS_API_URL = "https://neofund.sk/rovas-api";

function Screen3Charity() {
  const [inviteSubject, setInviteSubject] = useState("Žiadosť od darcu");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBody, setInviteBody] = useState(
    `Dobrý deň,\n\nprosím, vytvorte v Rováši projekt (${ROVAS_CHARITY_PROJECTS_URL}) pre vašu charitu, aby som vám mohol poslať finančný príspevok. Ak prispejem cez aplikáciu Civic, získam za dar merity — a to môže motivovať aj ostatných k darcovským príspevkom.\n\nĎakujem.`,
  );

  return (
    <Stack gap={16}>
      <ScreenTitle sk="Charitatívne projekty" />

      <Text tone="secondary" size="small">
        Hyperlinkovaný zoznam Rováš projektov charitatívnych organizácií. Každý odkaz vedie na stránku projektu, kde ho môžete priamo podporiť.
      </Text>

      <Stack gap={10}>
        <CharityProject
          name="Náš domov — Detský dom Topoľčany"
          org="Domov Topoľčany"
          desc="Mesačná podpora pre 24 detí v ústavnej starostlivosti."
          href="https://rovas.app/project/charity-detsky-dom-topolcany"
        />
        <CharityProject
          name="Pomoc ukrajinským utečencom"
          org="Človek v ohrození"
          desc="Ubytovanie, strava a integrácia v 4 slovenských mestách."
          href="https://rovas.app/project/charity-uvm-utecenci"
        />
        <CharityProject
          name="Obnova lesov v Tatranskom NP"
          org="Lesy Slovenska"
          desc="Sadenie pôvodných druhov stromov po kalamite v r. 2024."
          href="https://rovas.app/project/charity-tanap-obnova"
        />
        <CharityProject
          name="Strava pre seniorov v Košiciach"
          org="Senior Help"
          desc="Teplé jedlo pre 180 seniorov v sociálne slabých rodinách."
          href="https://rovas.app/project/charity-strava-kosice"
        />
      </Stack>

      <Text tone="secondary" size="small">
        Nenašli ste projekt svojej charity? Pošlite organizácii e-mail s prosbou — v správe ich odkážte na stránku{" "}
        <Link href={ROVAS_CHARITY_PROJECTS_URL}>vytvorte v Rováši projekt</Link>.
      </Text>

      <Card collapsible defaultOpen={false}>
        <CardHeader>Pozvať organizáciu do Rováša</CardHeader>
        <CardBody>
          <Stack gap={12}>
            <FormField label="Predmet">
              <TextInput value={inviteSubject} onChange={setInviteSubject} />
            </FormField>
            <FormField label="E-mail príjemcu">
              <TextInput
                type="email"
                value={inviteEmail}
                onChange={setInviteEmail}
                placeholder="info@charita.sk"
              />
            </FormField>
            <FormField label="Text správy">
              <TextArea value={inviteBody} onChange={setInviteBody} rows={7} />
            </FormField>
            <Row justify="end">
              <Button variant="primary">Odoslať žiadosť</Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function CharityProject({
  name,
  org,
  desc,
  href,
}: {
  name: string;
  org: string;
  desc: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader trailing={<Pill size="sm">{org}</Pill>}>{name}</CardHeader>
      <CardBody>
        <Stack gap={6}>
          <Text size="small">{desc}</Text>
          <Link href={href}>Otvoriť na rovas.app →</Link>
        </Stack>
      </CardBody>
    </Card>
  );
}

type RewardType = "merits" | "chrons";

function RadioOption({
  name,
  value,
  checked,
  label,
  onChange,
}: {
  name: string;
  value: RewardType;
  checked: boolean;
  label: string;
  onChange: (value: RewardType) => void;
}) {
  const t = useHostTheme();
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        style={{ accentColor: t.accent.primary }}
      />
      <Text size="small">{label}</Text>
    </label>
  );
}

function Screen4Volunteer() {
  const [rewardType, setRewardType] = useState<RewardType>("merits");

  return (
    <Stack gap={16}>
      <ScreenTitle sk="Reportujte dobrovoľnícku prácu" icon={<ReportIcon size={24} />} />

      <Text tone="secondary" size="small">
        Tento formulár slúži na jednorazové vykazovanie dobrovoľníckej práce. Po overení dvoma dobrovoľníkmi vám Rováš pripíše buď Chrony* alebo rovnaké množstvo Meritov podľa vašej voľby. Odoslaním formulára vám vzniká povinnosť overovať výkazy iných dobrovoľníkov.
      </Text>

      <Stack gap={12}>
        <FormField label="Projekt">
          <Stack gap={6}>
            <Select
              options={[
                { value: "__new__", label: "+ Vytvoriť nový projekt…" },
                { value: "tatry", label: "Obnova lesov v Tatranskom NP" },
                { value: "domov", label: "Detský dom Topoľčany — pomocné práce" },
                { value: "utecenci", label: "Pomoc ukrajinským utečencom" },
                { value: "kosice", label: "Strava pre seniorov v Košiciach" },
              ]}
              placeholder="Vyberte projekt…"
            />
            <Row justify="end">
              <Button variant="ghost">+ Vytvoriť nový projekt</Button>
            </Row>
          </Stack>
        </FormField>

        <Grid columns={2} gap={12}>
          <FormField label="Dátum">
            <TextInput placeholder="DD.MM.RRRR" />
          </FormField>
          <FormField label="Hodiny">
            <TextInput type="number" placeholder="napr. 4" />
          </FormField>
        </Grid>

        <FormField label="Popis činnosti">
          <TextArea placeholder="Stručný popis vykonanej práce…" rows={3} />
        </FormField>
      </Stack>

      <FormField label="Vyberte typ odmeny">
        <Row gap={16}>
          <RadioOption
            name="rewardType"
            value="merits"
            checked={rewardType === "merits"}
            label="Merity"
            onChange={setRewardType}
          />
          <RadioOption
            name="rewardType"
            value="chrons"
            checked={rewardType === "chrons"}
            label="Chrony"
            onChange={setRewardType}
          />
        </Row>
      </FormField>

      <Row justify="end" gap={8}>
        <Button variant="ghost">Zrušiť</Button>
        <Button variant="primary" disabled>
          Odoslať report
        </Button>
      </Row>

      <Text tone="secondary" size="small">
        Pravidelne prispievate?{" "}
        <Link href={ROVAS_API_URL}>Rováš API</Link>
        {" umožňuje automatizovať vykazovanie práce."}
      </Text>

      <ChronFooter />
    </Stack>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="small" weight="semibold">{label}</Text>
      {children}
    </Stack>
  );
}

type UserProfile = {
  username: string;
  displayName: string;
  totalMe: number;
  eurEquivalent: string;
  bucketIndex: number;
  communityRank: string;
  meritMix: { taxes: number; charity: number; volunteer: number };
  taxesLast3Months: [number, number, number];
  topCharities: Array<{ name: string; me: number }>;
  topVolunteerProjects: Array<{ name: string; me: number }>;
};

const MOCK_USER_PROFILES: Record<string, UserProfile> = {
  anna_nb: {
    username: "anna_nb",
    displayName: "Anna Nováková",
    totalMe: 3410,
    eurEquivalent: "2 670",
    bucketIndex: 5,
    communityRank: "Patrí medzi top 3 % prispievateľov za posledných 12 mesiacov.",
    meritMix: { taxes: 980, charity: 1680, volunteer: 750 },
    taxesLast3Months: [310, 340, 330],
    topCharities: [
      { name: "Detský dom Topoľčany", me: 720 },
      { name: "Človek v ohrození", me: 540 },
      { name: "Senior Help Košice", me: 420 },
    ],
    topVolunteerProjects: [
      { name: "Obnova lesov v Tatranskom NP", me: 310 },
      { name: "Pomoc ukrajinským utečencom", me: 260 },
      { name: "Detský dom Topoľčany — pomocné práce", me: 180 },
    ],
  },
  "milan.k": {
    username: "milan.k",
    displayName: "Milan Kováč",
    totalMe: 1980,
    eurEquivalent: "1 550",
    bucketIndex: 5,
    communityRank: "Patrí medzi top 8 % prispievateľov za posledných 12 mesiacov.",
    meritMix: { taxes: 1120, charity: 520, volunteer: 340 },
    taxesLast3Months: [180, 195, 210],
    topCharities: [
      { name: "Lesy Slovenska — obnova lesov", me: 280 },
      { name: "Domov Topoľčany", me: 150 },
      { name: "Človek v ohrození", me: 90 },
    ],
    topVolunteerProjects: [
      { name: "Komunitné ihrisko Brezno", me: 190 },
      { name: "Strava pre seniorov v Košiciach", me: 90 },
      { name: "Lokálne biofarmy východné SK", me: 60 },
    ],
  },
  sano: {
    username: "sano",
    displayName: "Sano",
    totalMe: 1248,
    eurEquivalent: "975",
    bucketIndex: 5,
    communityRank: "Patrí medzi top 14 % prispievateľov za posledných 12 mesiacov.",
    meritMix: { taxes: 890, charity: 210, volunteer: 148 },
    taxesLast3Months: [95, 112, 108],
    topCharities: [
      { name: "Senior Help Košice", me: 120 },
      { name: "Človek v ohrození", me: 55 },
      { name: "Domov Topoľčany", me: 35 },
    ],
    topVolunteerProjects: [
      { name: "Obnova lesov v Tatranskom NP", me: 80 },
      { name: "Pomoc ukrajinským utečencom", me: 42 },
      { name: "Komunitné ihrisko Brezno", me: 26 },
    ],
  },
  lucia: {
    username: "lucia",
    displayName: "Lucia Horváthová",
    totalMe: 613,
    eurEquivalent: "480",
    bucketIndex: 4,
    communityRank: "Patrí medzi top 32 % prispievateľov za posledných 12 mesiacov.",
    meritMix: { taxes: 280, charity: 190, volunteer: 143 },
    taxesLast3Months: [42, 48, 51],
    topCharities: [
      { name: "Domov Topoľčany", me: 110 },
      { name: "Senior Help Košice", me: 50 },
      { name: "Lesy Slovenska", me: 30 },
    ],
    topVolunteerProjects: [
      { name: "Strava pre seniorov v Košiciach", me: 95 },
      { name: "Detský dom Topoľčany — pomocné práce", me: 32 },
      { name: "Pomoc ukrajinským utečencom", me: 16 },
    ],
  },
};

const TAX_MONTH_LABELS = ["Apríl", "Máj", "Jún"];

function ClickableUsername({
  username,
  onClick,
}: {
  username: string;
  onClick: () => void;
}) {
  const t = useHostTheme();
  return (
    <span
      onClick={onClick}
      style={{ color: t.text.link, cursor: "pointer", fontWeight: 600 }}
    >
      {username}
    </span>
  );
}

function ScreenUserProfile({
  username,
  onBack,
}: {
  username: string;
  onBack: () => void;
}) {
  const t = useHostTheme();
  const profile = MOCK_USER_PROFILES[username];
  const headlineStyle: CSSProperties = {
    fontSize: 40,
    fontWeight: 600,
    color: t.accent.primary,
    lineHeight: 1.1,
  };

  if (!profile) {
    return (
      <Stack gap={16}>
        <Button variant="ghost" onClick={onBack}>← Komunita</Button>
        <Callout tone="warning" title="Profil nenájdený">
          <Text size="small">Používateľ @{username} nie je v mock dátach.</Text>
        </Callout>
      </Stack>
    );
  }

  const taxes3MonthTotal = profile.taxesLast3Months.reduce((a, b) => a + b, 0);

  return (
    <Stack gap={16}>
      <Row align="center" gap={8}>
        <Button variant="ghost" onClick={onBack}>← Komunita</Button>
      </Row>

      <ScreenTitle sk="Príspevok spoločnosti" centered />

      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo />
        <Text tone="tertiary" size="small">@{profile.username} · {profile.displayName}</Text>
        <div style={headlineStyle}>{formatMeWhole(profile.totalMe)} ME</div>
        <Text tone="secondary" size="small">~ {profile.eurEquivalent} €</Text>
      </Stack>

      <CommunityPositionPanel
        userMe={profile.totalMe}
        bucketIndex={profile.bucketIndex}
        username={profile.username}
      />

      <Stack gap={8}>
        <H3>Zdroje meritov</H3>
        <UsageBar
          total={profile.totalMe}
          topLeftLabel="Rozdelenie celkom"
          topRightLabel={`${formatMeWhole(profile.totalMe)} ME`}
          segments={[
            { id: "taxes", value: profile.meritMix.taxes, color: "blue" },
            { id: "charity", value: profile.meritMix.charity, color: "green" },
            { id: "volunteer", value: profile.meritMix.volunteer, color: "orange" },
          ]}
        />
        <Row gap={12} wrap>
          <Stat value={formatMeDecimal(profile.meritMix.taxes)} label="Dane" />
          <Stat value={formatMeDecimal(profile.meritMix.charity)} label="Charita" />
          <Stat value={formatMeDecimal(profile.meritMix.volunteer)} label="Dobrovoľník" />
        </Row>
      </Stack>

      <Card>
        <CardHeader trailing={<Pill size="sm">1</Pill>}>Platba daní</CardHeader>
        <CardBody>
          <Stack gap={10}>
            <Text tone="secondary" size="small">Zisk z DPH (bločky) za posledné 3 mesiace</Text>
            <BarChart
              height={110}
              categories={TAX_MONTH_LABELS}
              series={[{ name: "ME", data: [...profile.taxesLast3Months], tone: "info" }]}
            />
            <Row justify="end">
              <Stat value={`${formatMeDecimal(taxes3MonthTotal)} ME`} label="Spolu (3 mes.)" />
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">2</Pill>}>Charitatívny príspevok</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text tone="secondary" size="small">Top 3 organizácie podľa príspevku</Text>
            <Table
              headers={["Organizácia", "ME"]}
              columnAlign={["left", "right"]}
              rows={profile.topCharities.map((c) => [c.name, formatMeDecimal(c.me)])}
            />
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">3</Pill>}>Dobrovoľnícka práca</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text tone="secondary" size="small">Top 3 projekty podľa získaných meritov</Text>
            <Table
              headers={["Projekt", "ME"]}
              columnAlign={["left", "right"]}
              rows={profile.topVolunteerProjects.map((p) => [p.name, formatMeDecimal(p.me)])}
            />
          </Stack>
        </CardBody>
      </Card>

      <HomeFooter />
    </Stack>
  );
}


function Screen6Community() {
  const [phase, setPhase] = useCanvasState<"list" | "profile">("civic.community.phase", "list");
  const [profileUser, setProfileUser] = useCanvasState<string>("civic.community.profileUser", "anna_nb");
  const [query, setQuery] = useCanvasState<string>("civic.communityQuery", "");

  const openProfile = (username: string) => {
    setProfileUser(username);
    setPhase("profile");
  };

  if (phase === "profile") {
    return <ScreenUserProfile username={profileUser} onBack={() => setPhase("list")} />;
  }

  const recent: Array<{ username: string; me: string; rank: string }> = [
    { username: "anna_nb", me: "3 410 ME", rank: "top 3 %" },
    { username: "milan.k", me: "1 980 ME", rank: "top 8 %" },
    { username: "sano", me: "1 248 ME", rank: "top 14 %" },
    { username: "lucia", me: "613 ME", rank: "top 32 %" },
  ];
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Komunita" />

      <Text tone="secondary" size="small">
        Vyhľadajte iného používateľa podľa jeho mena v Rováši a pozrite si jeho verejný príspevok spoločnosti.
      </Text>

      <Stack gap={6}>
        <Text size="small" weight="semibold">Rováš užívateľské meno</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="napr. anna_nb"
          disabled
        />
      </Stack>

      <Row justify="end">
        <Button variant="primary" disabled>
          Vyhľadať
        </Button>
      </Row>

      <Card collapsible defaultOpen={false}>
        <CardHeader>Pozvať priateľa do Civic</CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Text tone="secondary" size="small">
              Pošlite priateľovi pozvánku e-mailom. Po jeho registrácii sa zobrazí v zozname vašich kontaktov.
            </Text>
            <FormField label="E-mail priateľa">
              <TextInput type="email" placeholder="kamarat@example.sk" />
            </FormField>
            <FormField label="Osobná správa">
              <TextArea
                placeholder="Pridajte krátky odkaz pre vášho priateľa…"
                rows={3}
              />
            </FormField>
            <Row justify="end">
              <Button variant="primary">Odoslať pozvánku</Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Stack gap={6}>
        <Text size="small" weight="semibold">Naposledy prezerané profily</Text>
      </Stack>

      <Table
        headers={["Používateľ", "Celkové ME", "Pozícia"]}
        columnAlign={["left", "right", "right"]}
        rows={recent.map((r) => [
          <ClickableUsername key={r.username} username={r.username} onClick={() => openProfile(r.username)} />,
          r.me,
          r.rank,
        ])}
      />

      <Callout tone="info">
        <Text size="small">
          Kliknite na používateľské meno a zobrazí sa verejný profil príspevku — podobný domovskej obrazovke s rozpadom meritov podľa daní, charity a dobrovoľníctva. Vyhľadávanie zostáva v1 deaktivované.
        </Text>
      </Callout>
    </Stack>
  );
}
