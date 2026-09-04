import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  displayMerits,
  percentileFromDistribution,
  type RankDistribution,
  type UserSearchResult,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchRankDistribution } from "@/lib/api";
import {
  loadRecentProfiles,
  type RecentProfile,
} from "@/lib/profile-recents";
import { useUserSearch } from "@/lib/use-user-search";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function topPctLabel(
  totalMe: number,
  distribution: RankDistribution | null,
): string {
  if (!distribution) return "—";
  const pct = percentileFromDistribution(distribution, totalMe);
  if (pct === null) return "—";
  const top = Math.max(1, Math.round(100 - pct));
  return `top ${top} %`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function CommunityScreen() {
  useLocale();
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentProfile[]>([]);
  const [distribution, setDistribution] = useState<RankDistribution | null>(
    null,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

  const { results, searching, searchError, queryLongEnough } = useUserSearch(
    query,
    { enabled: signedIn },
  );

  useFocusEffect(
    useCallback(() => {
      // Fresh Community visit: clear leftover typeahead and dismiss keyboard.
      setQuery("");
      setInviteOpen(false);
      setInviteError(null);
      Keyboard.dismiss();
      searchRef.current?.blur();

      void loadRecentProfiles().then(setRecents);
      if (status === "signedIn") {
        void fetchRankDistribution()
          .then(setDistribution)
          .catch(() => setDistribution(null));
      }
    }, [status]),
  );

  function openProfile(user: UserSearchResult | { username: string }) {
    router.push(`/(tabs)/community/${encodeURIComponent(user.username)}`);
  }

  async function onInvite() {
    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      setInviteError(t("community.invite_invalid_email"));
      return;
    }
    setInviteError(null);
    const personal = inviteMessage.trim();
    const defaultBody = t("community.invite_default_body");
    const body = personal ? `${personal}\n\n${defaultBody}` : defaultBody;
    const mailto =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(t("community.invite_subject"))}` +
      `&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      setInviteError(t("receipts.add_search_error"));
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>{t("community.intro")}</Text>

      {!signedIn ? (
        <View style={styles.authBox}>
          <Text style={styles.hint}>{t("community.sign_in_hint")}</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryText}>{t("home.sign_in")}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      <Text style={styles.label}>{t("community.search_label")}</Text>
      <View style={[styles.searchRow, !signedIn && styles.inputDisabled]}>
        <MaterialIcons
          name="search"
          size={22}
          color={colors.muted}
          style={styles.searchIcon}
        />
        <TextInput
          ref={searchRef}
          editable={signedIn}
          value={query}
          onChangeText={setQuery}
          placeholder={t("community.search_placeholder")}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={false}
          style={styles.searchInput}
        />
      </View>

      {signedIn && searching ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 4 }} />
      ) : null}
      {signedIn && searchError ? (
        <Text style={styles.error}>{t("receipts.add_search_error")}</Text>
      ) : null}

      {signedIn && queryLongEnough && !searching && !searchError ? (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>{t("receipts.add_results")}</Text>
          {results.length === 0 ? (
            <Text style={styles.hint}>{t("receipts.add_search_empty")}</Text>
          ) : (
            results.map((r) => (
              <Pressable
                key={r.rovas_uid}
                style={styles.resultRow}
                onPress={() => openProfile(r)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{r.username}</Text>
                  {r.display_name && r.display_name !== r.username ? (
                    <Text style={styles.resultDisplay}>{r.display_name}</Text>
                  ) : null}
                </View>
                <Text style={styles.resultAction}>{t("community.open_profile")}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.inviteCard}>
        <Pressable
          style={styles.inviteHeader}
          onPress={() => setInviteOpen((o) => !o)}
        >
          <Text style={styles.inviteTitle}>{t("community.invite_title")}</Text>
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
            <Text style={styles.hint}>{t("community.invite_body")}</Text>
            <Text style={styles.label}>{t("community.invite_email")}</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder={t("community.invite_email_placeholder")}
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Text style={styles.label}>{t("community.invite_message")}</Text>
            <TextInput
              value={inviteMessage}
              onChangeText={setInviteMessage}
              placeholder={t("community.invite_message_placeholder")}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
            />
            {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
            <Pressable
              style={[styles.primaryBtn, styles.searchBtn]}
              onPress={() => void onInvite()}
            >
              <Text style={styles.primaryText}>{t("community.invite_send")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>{t("community.recents_title")}</Text>

      {recents.length === 0 ? (
        <Text style={styles.hint}>{t("community.recents_empty")}</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colUser]}>
              {t("community.col_user")}
            </Text>
            <Text style={[styles.th, styles.colMe]}>
              {t("community.col_me")}
            </Text>
            <Text style={[styles.th, styles.colRank]}>
              {t("community.col_rank")}
            </Text>
          </View>
          {recents.map((r) => (
            <Pressable
              key={r.username}
              style={styles.tableRow}
              onPress={() => openProfile(r)}
              disabled={!signedIn}
            >
              <Text style={[styles.tdLink, styles.colUser]} numberOfLines={1}>
                {r.username}
              </Text>
              <Text style={[styles.td, styles.colMe]}>
                {formatMe(r.total_me)} {t("common.me")}
              </Text>
              <Text style={[styles.td, styles.colRank]}>
                {topPctLabel(r.total_me, distribution)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.callout}>{t("community.callout")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  authBox: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    color: colors.ink,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputDisabled: {
    backgroundColor: "#EEF2EF",
    color: colors.muted,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  searchBtn: { alignSelf: "flex-end", minWidth: 120 },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: colors.danger, fontSize: 14 },
  results: { gap: 8 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resultName: { fontWeight: "600", color: colors.ink, fontSize: 15 },
  resultDisplay: { fontSize: 12, color: colors.muted, marginTop: 2 },
  resultAction: { color: colors.brandSoft, fontWeight: "700", fontSize: 13 },
  inviteCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  inviteTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, flex: 1 },
  // Layout stays 24×24 so the header height follows the title; scale draws ~30px.
  inviteChevronWrap: {
    width: 24,
    height: 24,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteChevronIcon: {
    transform: [{ scale: 1.25 }],
  },
  inviteBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EEF2EF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    alignItems: "center",
  },
  th: { fontSize: 12, fontWeight: "600", color: colors.muted },
  td: { fontSize: 14, color: colors.ink },
  tdLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandSoft,
  },
  colUser: { flex: 1.2 },
  colMe: { flex: 1, textAlign: "right" },
  colRank: { flex: 0.9, textAlign: "right" },
  callout: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
});
