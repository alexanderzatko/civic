import { type CSSProperties, type ReactNode } from "react";
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
} from "cursor/canvas";

/**
 * Civic — Slovak-first mockup for the v1 information architecture.
 *
 * Canonical source: civic/mocs/civic-mockup.canvas.tsx (version-controlled).
 * The IDE-detected file at ~/.cursor/projects/.../canvases/civic-mockup.canvas.tsx
 * is a symlink to the file above, so edits in either place are kept in sync.
 *
 * Auth screens (Rovas OAuth + PKCE entry points):
 * - login:    Prihlasenie — provider chooser (Google / Facebook / Rovas)
 * - register: Registracia — same providers framed for first-time users
 *
 * Main IA:
 * - Screen 0: Home (Vas prispevok spolocnosti) — logged-in + logged-out
 * - Screen 1: Earn hub (Ziskat merity)
 * - Screen 2: Receipts (Blocky) — fully built v1 path
 * - Screen 3: Charity projects (stub: hyperlinks to Rovas)
 * - Screen 4: Volunteer report (stub: form skeleton)
 * - Screen 5: Investment projects (stub: hyperlinks to Rovas)
 * - Screen 6: Community / user lookup (stub: implemented later)
 */

type ScreenId = "login" | "register" | "0" | "1" | "2" | "3" | "4" | "5" | "6";

type ScreenGroup = "auth" | "ia";

const SCREENS: Array<{
  id: ScreenId;
  group: ScreenGroup;
  label: string;
  english: string;
  status: "Plne implementovaná" | "Naviguje" | "Stub";
  /** Optional small leading badge for the screen pill. Numeric main IA only. */
  pillNumber?: string;
}> = [
  { id: "login", group: "auth", label: "Prihlásenie", english: "Sign in", status: "Plne implementovaná" },
  { id: "register", group: "auth", label: "Registrácia", english: "Register", status: "Plne implementovaná" },
  { id: "0", group: "ia", label: "Domov", english: "Home", status: "Plne implementovaná", pillNumber: "0" },
  { id: "1", group: "ia", label: "Získať merity", english: "Earn hub", status: "Naviguje", pillNumber: "1" },
  { id: "2", group: "ia", label: "Bločky", english: "Receipts", status: "Plne implementovaná", pillNumber: "2" },
  { id: "3", group: "ia", label: "Charita", english: "Charity projects", status: "Stub", pillNumber: "3" },
  { id: "4", group: "ia", label: "Dobrovoľník", english: "Volunteer report", status: "Stub", pillNumber: "4" },
  { id: "5", group: "ia", label: "Investície", english: "Invest projects", status: "Stub", pillNumber: "5" },
  { id: "6", group: "ia", label: "Komunita", english: "Community / user lookup", status: "Stub", pillNumber: "6" },
];

export default function CivicMockup() {
  const [screen, setScreen] = useCanvasState<ScreenId>("civic.screen", "0");
  const [loggedIn, setLoggedIn] = useCanvasState<boolean>("civic.loggedIn", true);

  return (
    <Stack gap={24}>
      <Stack gap={6}>
        <H1>Civic — mockup obrazoviek</H1>
        <Text tone="secondary">
          Slovak-first UI mockup for the v1 IA. Click any pill to walk the flow. Auth screens (Prihlásenie / Registrácia) front-load the Rovas OAuth + PKCE flow; receipts ship end-to-end in v1; screens 3, 4, 5 ship as navigational stubs that hyperlink to Rovas project pages.
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
        {screen === "5" && <Screen5Invest />}
        {screen === "6" && <Screen6Community />}
      </Phone>

      <Stack gap={8}>
        <H2>Informačná architektúra v1</H2>
        <Text tone="secondary" size="small">
          Information architecture · v1 status per screen
        </Text>
        <Table
          headers={["#", "Slovak label", "English", "v1 status", "Primary action"]}
          columnAlign={["center", "left", "left", "left", "left"]}
          rows={[
            ["L", "Prihlásenie", "Sign in (OAuth provider chooser)", "Plne implementovaná", "Open Rovas authorize URL (PKCE)"],
            ["R", "Registrácia", "Register (provider chooser, framed for new users)", "Plne implementovaná", "Open Rovas authorize URL (PKCE)"],
            ["0", "Váš príspevok spoločnosti", "Home / contribution dashboard", "Plne implementovaná", "Získať merity → screen 1"],
            ["1", "Získať merity", "Earn hub", "Plne implementovaná (naviguje)", "→ screens 2 / 3 / 4 / 5"],
            ["2", "Bločky", "Receipts (eKasa scan + history)", "Plne implementovaná", "Naskenovať bloček"],
            ["3", "Charitatívne projekty", "Charity projects list", "Stub — hyperlinks to Rovas", "Open project on rovas.app"],
            ["4", "Dobrovoľnícka práca", "Volunteer work report", "Stub — form skeleton", "Submit (disabled v1)"],
            ["5", "Investičné projekty", "Investment projects list", "Stub — hyperlinks to Rovas", "Open project on rovas.app"],
            ["6", "Komunita", "Community / user lookup by Rovas username", "Stub — implemented later", "Search input (disabled v1)"],
          ]}
          rowTone={["info", "info", "success", "success", "success", "warning", "warning", "warning", "warning"]}
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
            onClick={() => setScreen(s.id)}
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
      <span>SK · EN</span>
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
      aria-label="Merit (ME) logo"
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

function ScreenTitle({ sk, en, centered }: { sk: string; en: string; centered?: boolean }) {
  const textAlign = centered ? "center" : undefined;
  return (
    <Stack gap={2} style={textAlign ? { textAlign } : undefined}>
      <H2 style={textAlign ? { textAlign } : undefined}>{sk}</H2>
      <Text tone="tertiary" size="small" style={textAlign ? { textAlign } : undefined}>{en}</Text>
    </Stack>
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
  rovas: "Prihlásiť sa s Rovas účtom",
};

const PROVIDER_LABEL_REGISTER: Record<AuthProvider, string> = {
  google: "Vytvoriť účet cez Google",
  facebook: "Vytvoriť účet cez Facebook",
  rovas: "Vytvoriť nový Rovas účet",
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
        <ScreenTitle sk="Prihláste sa" en="Sign in to Civic" />
      </Stack>

      <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
        Vyberte spôsob prihlásenia. Vaša identita v Civic je váš Rovas účet.
        <br />
        <Text tone="tertiary" size="small" as="span">
          Choose a sign-in method · your Civic identity is your Rovas account.
        </Text>
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
          Po kliknutí sa otvorí systémový prehliadač a presmeruje vás na Rovas (PKCE Authorization Code).
          Civic neuchováva vaše heslo — len krátkodobý prístupový token.
        </Text>
        <Text tone="tertiary" size="small">
          A system browser opens to Rovas for OAuth (PKCE). Civic stores only a short-lived access token.
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
        <ScreenTitle sk="Vytvorte si účet" en="Create your account" />
      </Stack>

      <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
        Pridajte sa ku komunite Civic — uvidíte celkový vplyv vašich príspevkov spoločnosti
        (dane, dobrovoľníctvo, charita) v jednom mieste.
        <br />
        <Text tone="tertiary" size="small" as="span">
          Join Civic to see your full societal contribution — taxes, volunteering, charity — in one place.
        </Text>
      </Text>

      <Stack gap={8}>
        <ProviderButton provider="google" label={PROVIDER_LABEL_REGISTER.google} onClick={() => signUp("google")} />
        <ProviderButton provider="facebook" label={PROVIDER_LABEL_REGISTER.facebook} onClick={() => signUp("facebook")} />
        <ProviderButton provider="rovas" label={PROVIDER_LABEL_REGISTER.rovas} onClick={() => signUp("rovas")} />
      </Stack>

      <Callout tone="info" title="Automatické prepojenie s Rovas">
        <Text size="small">
          Pri prihlásení cez Google alebo Facebook sa váš Rovas účet vytvorí automaticky cez HybridAuth.
          Žiadny separátny účet pre Civic nie je potrebný.
        </Text>
        <Text tone="tertiary" size="small">
          Sign in with Google or Facebook auto-creates a Rovas account via HybridAuth. No separate Civic account is needed.
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
  const headlineStyle: CSSProperties = {
    fontSize: 40,
    fontWeight: 600,
    color: t.accent.primary,
    lineHeight: 1.1,
  };
  return (
    <Stack gap={18}>
      <ScreenTitle sk="Váš príspevok spoločnosti" en="Your contribution to society" centered />

      <Stack gap={8} style={{ alignItems: "center" }}>
        <MeLogo />
        <div style={headlineStyle}>1 248 ME</div>
        <Text tone="secondary" size="small">~ 975 € · EUR equivalent</Text>
      </Stack>

      <RankDistributionChart highlightUser />

      <Callout
        tone="info"
        title={
          <>
            Vaša pozícia v{" "}
            <span
              onClick={() => goto("6")}
              style={{ color: t.text.link, cursor: "pointer", textDecoration: "underline" }}
            >
              komunite
            </span>
          </>
        }
      >
        <Text>
          Patríte medzi top 14 % prispievateľov za posledných 12 mesiacov.
        </Text>
        <Text tone="tertiary" size="small">
          You are in the top 14% of contributors over the last 12 months.
        </Text>
      </Callout>

      <Row justify="center">
        <Button variant="primary" onClick={() => goto("1")}>
          Získať merity
        </Button>
      </Row>

      <Text tone="tertiary" size="small" style={{ textAlign: "center" }}>
        * 10 meritov = 1 hodina práce
      </Text>
    </Stack>
  );
}

/**
 * Distribution histogram of users by total Merit balance, modelled on the
 * existing Rovas Merit Distribution module's services endpoint output. Buckets
 * are log-scale (powers of 10). When `highlightUser` is set, the user's bucket
 * is rendered in accent tone and a username + total label is shown below.
 */
const RANK_BUCKET_LABELS = ["<0,1", "0,1–1", "1–10", "10–100", "100–1k", "1k–10k", "10k–100k", "100k+"];
const RANK_BUCKET_COUNTS = [5, 19, 48, 104, 93, 23, 5, 1];
const USER_BUCKET_INDEX = 5;

function RankDistributionChart({ highlightUser }: { highlightUser: boolean }) {
  const communityData = highlightUser
    ? RANK_BUCKET_COUNTS.map((v, i) => (i === USER_BUCKET_INDEX ? 0 : v))
    : RANK_BUCKET_COUNTS;
  const userBucketData = highlightUser
    ? RANK_BUCKET_COUNTS.map((v, i) => (i === USER_BUCKET_INDEX ? v : 0))
    : RANK_BUCKET_COUNTS.map(() => 0);
  const series = highlightUser
    ? [
        { name: "Komunita", data: communityData, tone: "neutral" as const },
        { name: "Vaša kategória", data: userBucketData, tone: "info" as const },
      ]
    : [{ name: "Komunita", data: communityData, tone: "neutral" as const }];
  return (
    <Stack gap={6}>
      <Text size="small" weight="semibold">Distribúcia používateľov podľa veľkosti príspevku</Text>
      <Text tone="tertiary" size="small">
        Rank distribution · source: Rovas Merit Distribution module · log-scale buckets (ME)
      </Text>
      <BarChart
        height={140}
        categories={RANK_BUCKET_LABELS}
        series={series}
        stacked={highlightUser}
      />
      {highlightUser && (
        <Text tone="secondary" size="small" style={{ textAlign: "center" }}>
          Vy:{" "}
          <Text as="span" weight="semibold">sano</Text>
          {" · 1 248 ME · kategória 1k–10k"}
        </Text>
      )}
    </Stack>
  );
}

function Screen0LoggedOut({ goto }: { goto: (s: ScreenId) => void }) {
  const t = useHostTheme();
  const headlineStyle: CSSProperties = {
    fontSize: 32,
    fontWeight: 600,
    color: t.accent.primary,
    lineHeight: 1.1,
  };
  return (
    <Stack gap={18}>
      <ScreenTitle sk="Váš príspevok spoločnosti" en="Your contribution to society" centered />

      <Stack gap={6} style={{ alignItems: "center" }}>
        <Text size="small" weight="semibold">Celková hodnota registrovaných príspevkov</Text>
        <Text tone="tertiary" size="small">Total value of all registered contributions to date</Text>
        <MeLogo size={48} />
        <div style={headlineStyle}>84 320 ME</div>
        <Text tone="secondary" size="small">~ 65 770 €</Text>
      </Stack>

      <RankDistributionChart highlightUser={false} />

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

function Screen1Earn({ goto }: { goto: (s: ScreenId) => void }) {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Získať merity" en="Earn merits" />

      <Text tone="secondary" size="small">
        Nárok na zisk meritov máte vždy keď odovzdáte ekonomickú hodnotu spoločnosti.
        Tu sú tri hlavné možnosti:
      </Text>

      <Card>
        <CardHeader trailing={<Pill size="sm">1</Pill>}>Platba daní</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Row align="center" gap={8} wrap>
              <Text weight="semibold" size="small">DPH</Text>
              <Spacer />
              <Button variant="primary" onClick={() => goto("2")}>
                Zoskenovať bloček
              </Button>
            </Row>
            <Row align="center" gap={8} wrap>
              <Text weight="semibold" size="small">Daň z príjmu</Text>
              <Spacer />
              <Pill size="sm">bude implementované neskôr</Pill>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">2</Pill>}>Charitatívny príspevok</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Row align="center" gap={8} wrap>
              <Text size="small">Vyberte si charitatívnu organizáciu a pošlite jej peniaze</Text>
              <Spacer />
              <Button variant="secondary" onClick={() => goto("3")}>
                Charity
              </Button>
            </Row>
            <Row align="center" gap={8} wrap>
              <Text size="small">Investujte do charitatívnych projektov</Text>
              <Spacer />
              <Button variant="secondary" onClick={() => goto("5")}>
                Investovať
              </Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader trailing={<Pill size="sm">3</Pill>}>Dobrovoľnícka práca</CardHeader>
        <CardBody>
          <Row align="center" gap={8} wrap>
            <Text size="small">Reportujte svoju dobrovoľnícku prácu</Text>
            <Spacer />
            <Button variant="secondary" onClick={() => goto("4")}>
              Reportovať
            </Button>
          </Row>
        </CardBody>
      </Card>
    </Stack>
  );
}

function Screen2Receipts() {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Bločky" en="Receipts" />

      <Row justify="center">
        <Button variant="primary">Naskenovať nový bloček</Button>
      </Row>

      <Stack gap={4}>
        <H3>Naskenované bločky</H3>
        <Text tone="tertiary" size="small">Recently scanned receipts · VAT verified by Finančná správa</Text>
      </Stack>

      <Table
        headers={["Dátum", "Predajca", "DPH €", "ME"]}
        columnAlign={["left", "left", "right", "right"]}
        rows={[
          ["11.6.2026", "Tesco Bratislava", "4,82", "6"],
          ["8.6.2026", "Lidl Petržalka", "2,19", "3"],
          ["4.6.2026", "Kaufland Trnava", "7,40", "9"],
          ["1.6.2026", "Billa Žilina", "1,05", "1"],
          ["28.5.2026", "Slovnaft Nitra", "12,30", "16"],
        ]}
        rowTone={["success", "success", "success", "success", "success"]}
      />

      <Callout tone="info">
        <Text size="small">
          Po naskenovaní bločka Civic overí jeho registráciu vo Finančnej správe a vypočíta zodpovedajúci počet meritov podľa zaplatenej DPH.
        </Text>
      </Callout>
    </Stack>
  );
}

function Screen3Charity() {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Charitatívne projekty" en="Charity projects" />

      <Text tone="secondary" size="small">
        Hyperlinkovaný zoznam Rovas projektov charitatívnych organizácií. Každý odkaz vedie na stránku projektu, kde ho môžete priamo podporiť.
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

      <Callout tone="warning" title="v1 stub">
        <Text size="small">
          Dáta sa v1 načítavajú priamo z Rovas API. Odkazy vedú na stránku projektu v Rovas, kde funguje existujúci tok podpory.
        </Text>
      </Callout>
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

function Screen4Volunteer() {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Reportujte dobrovoľnícku prácu" en="Report volunteer work" />

      <Text tone="secondary" size="small">
        Zjednodušený formulár — zbiera dáta z Rovas formulára. Po odoslaní sa zaznamená v Rovase a získate zodpovedajúce merity.
      </Text>

      <Stack gap={12}>
        <FormField label="Projekt" hint="Project">
          <Select
            options={[
              { value: "tatry", label: "Obnova lesov v Tatranskom NP" },
              { value: "domov", label: "Detský dom Topoľčany — pomocné práce" },
              { value: "utecenci", label: "Pomoc ukrajinským utečencom" },
              { value: "kosice", label: "Strava pre seniorov v Košiciach" },
            ]}
            placeholder="Vyberte projekt…"
          />
        </FormField>

        <Grid columns={2} gap={12}>
          <FormField label="Dátum" hint="Date">
            <TextInput placeholder="DD.MM.RRRR" />
          </FormField>
          <FormField label="Hodiny" hint="Hours">
            <TextInput type="number" placeholder="napr. 4" />
          </FormField>
        </Grid>

        <FormField label="Popis činnosti" hint="Description">
          <TextArea placeholder="Stručný popis vykonanej práce…" rows={3} />
        </FormField>
      </Stack>

      <Row justify="end" gap={8}>
        <Button variant="ghost">Zrušiť</Button>
        <Button variant="primary" disabled>
          Odoslať report
        </Button>
      </Row>

      <Callout tone="warning" title="v1 stub">
        <Text size="small">
          Odoslanie sa v1 nezachytáva — formulár ukazuje cieľový tvar. Submit endpoint na Rovas strane je naplánovaný v Phase 3.
        </Text>
      </Callout>
    </Stack>
  );
}

function FormField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Row align="center" gap={6}>
        <Text size="small" weight="semibold">{label}</Text>
        <Text size="small" tone="tertiary">· {hint}</Text>
      </Row>
      {children}
    </Stack>
  );
}

function Screen5Invest() {
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Investičné projekty" en="Investment projects" />

      <Text tone="secondary" size="small">
        Namiesto priameho zasielania peňazí je možné do niektorých projektov aj investovať. Tým vzniká možnosť automatického zisku meritov v budúcnosti.
      </Text>

      <Stack gap={10}>
        <InvestProject
          name="Komunitná solárna elektráreň Žilina"
          range="50 – 500 €"
          yieldNote="≈ 4 ME / rok"
          href="https://rovas.app/project/invest-solar-zilina"
        />
        <InvestProject
          name="Výstavba detského ihriska Brezno"
          range="20 – 200 €"
          yieldNote="≈ 1 ME / rok"
          href="https://rovas.app/project/invest-ihrisko-brezno"
        />
        <InvestProject
          name="Lokálne biofarmy východné Slovensko"
          range="100 – 1 000 €"
          yieldNote="≈ 6 ME / rok"
          href="https://rovas.app/project/invest-biofarmy-vychod"
        />
      </Stack>

      <Callout tone="warning" title="v1 stub">
        <Text size="small">
          Zoznam sa v1 načítava z Rovas API. Investičný tok prebieha na rovas.app — Civic ho len objavuje.
        </Text>
      </Callout>
    </Stack>
  );
}

function InvestProject({
  name,
  range,
  yieldNote,
  href,
}: {
  name: string;
  range: string;
  yieldNote: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader trailing={<Pill size="sm">{range}</Pill>}>{name}</CardHeader>
      <CardBody>
        <Stack gap={6}>
          <Row gap={12} align="center" wrap>
            <Stat value={yieldNote} label="Očakávaný výnos" />
          </Row>
          <Link href={href}>Otvoriť na rovas.app →</Link>
        </Stack>
      </CardBody>
    </Card>
  );
}

function Screen6Community() {
  const [query, setQuery] = useCanvasState<string>("civic.communityQuery", "");
  const recent: Array<{ username: string; me: string; rank: string }> = [
    { username: "anna_nb", me: "3 410 ME", rank: "top 3 %" },
    { username: "milan.k", me: "1 980 ME", rank: "top 8 %" },
    { username: "sano", me: "1 248 ME", rank: "top 14 %" },
    { username: "lucia", me: "613 ME", rank: "top 32 %" },
  ];
  return (
    <Stack gap={16}>
      <ScreenTitle sk="Komunita" en="Community · find a Rovas user" />

      <Text tone="secondary" size="small">
        Vyhľadajte iného používateľa podľa jeho mena na Rovase a pozrite si jeho verejný príspevok spoločnosti.
      </Text>

      <Stack gap={6}>
        <Text size="small" weight="semibold">Rovas užívateľské meno</Text>
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

      <Stack gap={6}>
        <Text size="small" weight="semibold">Naposledy prezerané profily</Text>
        <Text tone="tertiary" size="small">Recently viewed profiles · placeholder</Text>
      </Stack>

      <Table
        headers={["Používateľ", "Celkové ME", "Pozícia"]}
        columnAlign={["left", "right", "right"]}
        rows={recent.map((r) => [r.username, r.me, r.rank])}
      />

      <Callout tone="warning" title="Implementované neskôr">
        <Text size="small">
          Vyhľadávanie a profily používateľov sú naplánované na Phase 3+. v1 zobrazuje len kostru obrazovky a deaktivovaný formulár.
          Profil bude zobrazovať: distribúciu meritov podľa zdroja, pozíciu v komunite a odkazy na verejné Rovas projekty používateľa.
        </Text>
        <Text tone="tertiary" size="small">
          User lookup + public profiles ship in Phase 3+. v1 only renders the screen skeleton with a disabled search form.
        </Text>
      </Callout>
    </Stack>
  );
}
