import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link } from "expo-router";
import {
  DEFAULT_SETTINGS,
  round2,
  type CharityProject,
  type MeritRate,
} from "@civic/shared";
import { ProjectDetailModal } from "@/components/ProjectDetailModal";
import { colors } from "@/constants/theme";
import { createCharityOrg, fetchMeritRate, fetchProjects } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  countryLabel,
  isCountryIso2,
  listCountries,
} from "@/lib/countries";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { getRovasBaseUrl } from "@/lib/oauth";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_TOTAL = 6;
const DEFAULT_MERITS_PER_HOUR = 10;
/** Keep a little air under the focused field when scrolling above the keyboard. */
const FOCUS_SCROLL_PAD = 16;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsite(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidIban(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized);
}

/** Pass-through donor yield: ME per € at the national hourly rate. */
function mePerEur(rate: MeritRate | null): number {
  const hourly = rate?.hourly_wage_eur ?? DEFAULT_SETTINGS.hourlyWageEur;
  const perHour = rate?.merits_per_hour ?? DEFAULT_MERITS_PER_HOUR;
  if (!(hourly > 0)) return 0;
  return round2(perHour / hourly);
}

function formatMePerEur(n: number): string {
  return n.toLocaleString("sk-SK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function charityEnrollmentUrl(): string {
  return `${getRovasBaseUrl().replace(/\/$/, "")}/charity-projects`;
}

export default function CharityScreen() {
  const { locale } = useLocale();
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "signedIn";
  const scrollRef = useRef<ScrollView>(null);
  const scrollHostRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const addOrgIdRef = useRef<TextInput>(null);
  const addIbanRef = useRef<TextInput>(null);

  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [projectNid, setProjectNid] = useState<string | null>(null);
  const [fallbackTitle, setFallbackTitle] = useState<string | null>(null);
  const [meritRate, setMeritRate] = useState<MeritRate | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCountry, setAddCountry] = useState("SK");
  const [addCountryOpen, setAddCountryOpen] = useState(false);
  const [addWebsite, setAddWebsite] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addOrgId, setAddOrgId] = useState("");
  const [addIban, setAddIban] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const countries = useMemo(() => listCountries(locale), [locale]);
  const addCountryLabel = countryLabel(addCountry, locale);

  function scrollFieldIntoView(field: TextInput | null) {
    // Wait for KeyboardAvoidingView padding, then nudge only as far as needed.
    setTimeout(() => {
      if (!field || !scrollRef.current || !scrollHostRef.current) return;
      field.measureInWindow((_x, y, _w, h) => {
        scrollHostRef.current?.measureInWindow((_sx, sy, _sw, sh) => {
          const fieldBottom = y + h + FOCUS_SCROLL_PAD;
          const visibleBottom = sy + sh;
          const overlap = fieldBottom - visibleBottom;
          if (overlap <= 0) return;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollYRef.current + overlap),
            animated: true,
          });
        });
      });
    }, 280);
  }

  const showSearch = total >= SEARCH_MIN_TOTAL;
  const donorRate = mePerEur(meritRate);

  const loadDefault = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchProjects("charity");
      let list = res.projects;
      let catalogTotal = res.total;
      // When fewer than 6 charities exist, ensure we show the full catalog.
      if (catalogTotal < SEARCH_MIN_TOTAL && list.length < catalogTotal) {
        const all = await fetchProjects("charity", { limit: catalogTotal });
        list = all.projects;
        catalogTotal = all.total;
      }
      setProjects(list);
      setTotal(catalogTotal);
    } catch {
      setProjects([]);
      setTotal(0);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDefault();
  }, [loadDefault]);

  useEffect(() => {
    void fetchMeritRate()
      .then(setMeritRate)
      .catch(() => setMeritRate(null));
  }, []);
  useEffect(() => {
    if (!showSearch) return;

    const q = query.trim();
    if (!q) {
      setSearching(false);
      void loadDefault();
      return;
    }

    let cancelled = false;
    setSearching(true);
    setLoadError(false);
    const handle = setTimeout(() => {
      void fetchProjects("charity", { query: q })
        .then((res) => {
          if (cancelled) return;
          setProjects(res.projects);
          setTotal(res.total);
          setSearching(false);
        })
        .catch(() => {
          if (cancelled) return;
          setProjects([]);
          setSearching(false);
          setLoadError(true);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, showSearch, loadDefault]);

  function openProject(p: CharityProject) {
    const nid = p.project_nid ?? (/^\d+$/.test(p.id) ? p.id : null);
    if (!nid) return;
    setFallbackTitle(p.title);
    setProjectNid(nid);
  }

  async function onInvite() {
    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      setInviteError(t("charity.invite_invalid_email"));
      return;
    }
    setInviteError(null);
    const personal = inviteMessage.trim();
    const enrollment = charityEnrollmentUrl();
    const defaultBody = `${t("charity.invite_default_body")}\n${enrollment}`;
    const body = personal ? `${personal}\n\n${defaultBody}` : defaultBody;
    const mailto =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(t("charity.invite_subject"))}` +
      `&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      setInviteError(t("charity.invite_send_error"));
    }
  }

  async function onAddOrg() {
    if (!signedIn) return;

    const name = addName.trim();
    const country = addCountry.trim().toUpperCase();
    const website = addWebsite.trim();
    const email = addEmail.trim();
    const orgId = addOrgId.trim();
    const iban = addIban.replace(/\s+/g, "").toUpperCase();

    if (!name) {
      setAddError(t("charity.add_invalid_name"));
      return;
    }
    if (!isCountryIso2(country)) {
      setAddError(t("charity.add_invalid_country"));
      return;
    }
    if (!isValidWebsite(website)) {
      setAddError(t("charity.add_invalid_website"));
      return;
    }
    if (!isValidEmail(email)) {
      setAddError(t("charity.add_invalid_email"));
      return;
    }
    if (!orgId) {
      setAddError(t("charity.add_invalid_org_id"));
      return;
    }
    if (!isValidIban(iban)) {
      setAddError(t("charity.add_invalid_iban"));
      return;
    }

    setAddError(null);
    setAddSubmitting(true);
    try {
      const res = await createCharityOrg({
        name,
        country,
        website_url: website,
        contact_email: email,
        org_id: orgId,
        iban,
      });
      if (!res.ok) {
        setAddError(res.message || t("charity.add_error"));
        return;
      }
      if (res.status === "approved") {
        Alert.alert(
          t("charity.add_approved_title"),
          t("charity.add_approved_body").replace("{{name}}", res.organization),
        );
        setAddOpen(false);
        setAddName("");
        setAddWebsite("");
        setAddEmail("");
        setAddOrgId("");
        setAddIban("");
        setAddCountry("SK");
        await loadDefault();
        setFallbackTitle(res.organization);
        setProjectNid(res.project_nid);
      } else {
        Alert.alert(
          t("charity.add_pending_title"),
          t("charity.add_pending_body"),
        );
        setAddOpen(false);
        setAddName("");
        setAddWebsite("");
        setAddEmail("");
        setAddOrgId("");
        setAddIban("");
        setAddCountry("SK");
      }
    } catch {
      setAddError(t("charity.add_error"));
    } finally {
      setAddSubmitting(false);
    }
  }

  const qTrim = query.trim();
  const showEmptySearch =
    showSearch &&
    qTrim.length > 0 &&
    !searching &&
    !loading &&
    projects.length === 0 &&
    !loadError;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <View ref={scrollHostRef} style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <Text style={styles.intro}>{t("charity.intro")}</Text>

        {showSearch ? (
          <View style={styles.searchBlock}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("charity.search_placeholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        ) : null}

        {loading || searching ? (
          <ActivityIndicator color={colors.brand} />
        ) : null}

        {loadError ? (
          <Text style={styles.error}>{t("charity.load_error")}</Text>
        ) : null}

        {!loading &&
        !searching &&
        !loadError &&
        projects.length === 0 &&
        !showEmptySearch ? (
          <Text style={styles.hint}>{t("charity.empty")}</Text>
        ) : null}

        {showEmptySearch ? (
          <Text style={styles.hint}>{t("charity.search_empty")}</Text>
        ) : null}

        {projects.map((p) => (
          <Pressable
            key={p.id}
            style={styles.card}
            onPress={() => openProject(p)}
          >
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.org}>{p.organization}</Text>
            {p.summary ? (
              <Text style={styles.summary} numberOfLines={3}>
                {p.summary}
              </Text>
            ) : null}
            {donorRate > 0 ? (
              <View style={styles.meRow}>
                <Text style={styles.meLabel}>{t("charity.me_per_eur_label")}</Text>
                <Text style={styles.meRate} numberOfLines={1}>
                  {t("charity.me_per_eur").replace(
                    "{{rate}}",
                    formatMePerEur(donorRate),
                  )}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        <View style={styles.inviteCard}>
          <Pressable
            style={styles.inviteHeader}
            onPress={() => setAddOpen((o) => !o)}
          >
            <Text style={styles.inviteTitle}>{t("charity.add")}</Text>
            <View style={styles.inviteChevronWrap}>
              <MaterialIcons
                name={addOpen ? "expand-more" : "chevron-right"}
                size={24}
                color={colors.muted}
                style={styles.inviteChevronIcon}
              />
            </View>
          </Pressable>
          {addOpen ? (
            <View style={styles.inviteBody}>
              <Text style={styles.hint}>{t("charity.add_body")}</Text>

              {!signedIn ? (
                <View style={styles.authBox}>
                  <Text style={styles.hint}>{t("charity.add_sign_in")}</Text>
                  <Link href="/(auth)/login" asChild>
                    <Pressable style={styles.primaryBtn}>
                      <Text style={styles.primaryText}>
                        {t("home.sign_in")}
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>{t("charity.add_name")}</Text>
                  <TextInput
                    value={addName}
                    onChangeText={setAddName}
                    placeholder={t("charity.add_name_placeholder")}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t("charity.add_country")}</Text>
                  <Pressable
                    style={styles.select}
                    onPress={() => setAddCountryOpen(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.selectText} numberOfLines={1}>
                      {addCountryLabel}
                    </Text>
                    <MaterialIcons
                      name="expand-more"
                      size={22}
                      color={colors.muted}
                    />
                  </Pressable>

                  <Text style={styles.label}>{t("charity.add_website")}</Text>
                  <TextInput
                    value={addWebsite}
                    onChangeText={setAddWebsite}
                    placeholder={t("charity.add_website_placeholder")}
                    placeholderTextColor={colors.muted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t("charity.add_email")}</Text>
                  <View style={styles.emailRow}>
                    <TextInput
                      value={addEmail}
                      onChangeText={setAddEmail}
                      placeholder={t("charity.add_email_placeholder")}
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.input, styles.emailInput]}
                    />
                    <Pressable
                      style={styles.verifyBtn}
                      onPress={() => setVerifyOpen(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.verifyBtnText}>
                        {t("charity.verify")}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>{t("charity.add_org_id")}</Text>
                  <TextInput
                    ref={addOrgIdRef}
                    value={addOrgId}
                    onChangeText={setAddOrgId}
                    placeholder={t("charity.add_org_id_placeholder")}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={styles.input}
                    onFocus={() => scrollFieldIntoView(addOrgIdRef.current)}
                  />

                  <Text style={styles.label}>{t("charity.add_iban")}</Text>
                  <TextInput
                    ref={addIbanRef}
                    value={addIban}
                    onChangeText={setAddIban}
                    placeholder={t("charity.add_iban_placeholder")}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={styles.input}
                    onFocus={() => scrollFieldIntoView(addIbanRef.current)}
                  />

                  {addError ? (
                    <Text style={styles.error}>{addError}</Text>
                  ) : null}
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      addSubmitting && styles.primaryBtnDisabled,
                    ]}
                    disabled={addSubmitting}
                    onPress={() => void onAddOrg()}
                  >
                    {addSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>
                        {t("charity.add_submit")}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.inviteCard}>
          <Pressable
            style={styles.inviteHeader}
            onPress={() => setInviteOpen((o) => !o)}
          >
            <Text style={styles.inviteTitle}>{t("charity.invite")}</Text>
            <View style={styles.inviteChevronWrap}>
              <MaterialIcons
                name={inviteOpen ? "expand-more" : "chevron-right"}
                size={24}
                color={colors.muted}
                style={styles.inviteChevronIcon}
              />
            </View>
          </Pressable>
          {inviteOpen ? (
            <View style={styles.inviteBody}>
              <Text style={styles.hint}>{t("charity.invite_body")}</Text>
              <Text style={styles.label}>{t("charity.invite_email")}</Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder={t("charity.invite_email_placeholder")}
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.label}>{t("charity.invite_message")}</Text>
              <TextInput
                value={inviteMessage}
                onChangeText={setInviteMessage}
                placeholder={t("charity.invite_message_placeholder")}
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
              />
              {inviteError ? (
                <Text style={styles.error}>{inviteError}</Text>
              ) : null}
              <Pressable
                style={styles.primaryBtn}
                onPress={() => void onInvite()}
              >
                <Text style={styles.primaryText}>
                  {t("charity.invite_send")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
      </View>
      </KeyboardAvoidingView>

      <ProjectDetailModal
        projectNid={projectNid}
        fallbackTitle={fallbackTitle}
        onClose={() => {
          setProjectNid(null);
          setFallbackTitle(null);
        }}
      />

      <Modal
        visible={addCountryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddCountryOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAddCountryOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("charity.add_country")}</Text>
            <Pressable onPress={() => setAddCountryOpen(false)} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {countries.map((country) => {
              const active = addCountry === country.iso2;
              return (
                <Pressable
                  key={country.iso2}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    setAddCountry(country.iso2);
                    setAddCountryOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}
                  >
                    {country.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={verifyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVerifyOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setVerifyOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            <Text style={styles.modalTitle}>{t("charity.verify_title")}</Text>
            <Text style={styles.modalBody}>{t("charity.verify_body")}</Text>
            <Text style={styles.modalHint}>
              {t("charity.verify_coming_soon")}
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setVerifyOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t("common.close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
  searchBlock: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  selectText: { flex: 1, fontSize: 15, color: colors.ink, marginRight: 8 },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  org: { color: colors.brandSoft, fontWeight: "600", fontSize: 13 },
  summary: { color: colors.muted, fontSize: 14, marginTop: 2 },
  meRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 6,
  },
  meLabel: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  meRate: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 10,
    lineHeight: 14,
    flexShrink: 0,
  },
  inviteCard: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "#E8EFEA",
    overflow: "hidden",
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  inviteTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, flex: 1 },
  inviteChevronWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteChevronIcon: { marginTop: 1 },
  inviteBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
  authBox: { gap: 10 },
  emailRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  emailInput: { flex: 1 },
  verifyBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifyBtnText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.brand,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  modalBody: { fontSize: 14, lineHeight: 20, color: colors.ink },
  modalHint: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    maxHeight: "60%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, flex: 1 },
  sheetBody: { padding: 16, gap: 8 },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: {
    borderColor: colors.brand,
    backgroundColor: "#EEF2EF",
  },
  optionText: { fontSize: 15, color: colors.ink },
  optionTextActive: { fontWeight: "600", color: colors.brandSoft },
});
