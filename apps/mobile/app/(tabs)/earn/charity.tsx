import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { displayMerits, type CharityProject } from "@civic/shared";
import { ProjectDetailModal } from "@/components/ProjectDetailModal";
import { colors } from "@/constants/theme";
import { fetchProjects } from "@/lib/api";
import { t } from "@/lib/i18n";
import { getRovasBaseUrl } from "@/lib/oauth";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_TOTAL = 6;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function charityEnrollmentUrl(): string {
  return `${getRovasBaseUrl().replace(/\/$/, "")}/charity-projects`;
}

export default function CharityScreen() {
  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [projectNid, setProjectNid] = useState<string | null>(null);
  const [fallbackTitle, setFallbackTitle] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const showSearch = total >= SEARCH_MIN_TOTAL;

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

  const qTrim = query.trim();
  const showEmptySearch = showSearch && qTrim.length > 0 && !searching && !loading && projects.length === 0 && !loadError;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
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

        {!loading && !searching && !loadError && projects.length === 0 && !showEmptySearch ? (
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
            {p.total_me != null ? (
              <Text style={styles.me}>
                {formatMe(p.total_me)} {t("common.me")}
              </Text>
            ) : null}
          </Pressable>
        ))}

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
              <Pressable style={styles.primaryBtn} onPress={() => void onInvite()}>
                <Text style={styles.primaryText}>{t("charity.invite_send")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ProjectDetailModal
        projectNid={projectNid}
        fallbackTitle={fallbackTitle}
        onClose={() => {
          setProjectNid(null);
          setFallbackTitle(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 14 },
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
  me: { color: colors.ink, fontWeight: "600", fontSize: 13, marginTop: 4 },
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
  primaryBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.brand,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
