import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import {
  displayMerits,
  percentileFromDistribution,
  type RankDistribution,
} from "@civic/shared";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { lookupUser, fetchRankDistribution } from "@/lib/api";
import {
  loadRecentProfiles,
  type RecentProfile,
} from "@/lib/profile-recents";
import { t } from "@/lib/i18n";

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
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentProfile[]>([]);
  const [distribution, setDistribution] = useState<RankDistribution | null>(
    null,
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadRecentProfiles().then(setRecents);
      if (status === "signedIn") {
        void fetchRankDistribution()
          .then(setDistribution)
          .catch(() => setDistribution(null));
      }
    }, [status]),
  );

  async function onSearch() {
    const username = query.trim();
    if (!username || !signedIn || searching) return;
    setSearching(true);
    setError(null);
    try {
      const profile = await lookupUser(username);
      router.push(`/(tabs)/community/${encodeURIComponent(profile.username)}`);
    } catch (err) {
      const statusCode = (err as { status?: number })?.status;
      setError(
        statusCode === 404
          ? t("community.not_found")
          : t("community.search_error"),
      );
    } finally {
      setSearching(false);
    }
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
      setInviteError(t("community.search_error"));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
      <TextInput
        editable={signedIn && !searching}
        value={query}
        onChangeText={setQuery}
        placeholder={t("community.search_placeholder")}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, !signedIn && styles.inputDisabled]}
        onSubmitEditing={() => void onSearch()}
        returnKeyType="search"
      />

      <Pressable
        style={[
          styles.primaryBtn,
          styles.searchBtn,
          (!signedIn || searching || !query.trim()) && styles.btnDisabled,
        ]}
        disabled={!signedIn || searching || !query.trim()}
        onPress={() => void onSearch()}
      >
        {searching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t("community.search_button")}</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inviteCard}>
        <Pressable
          style={styles.inviteHeader}
          onPress={() => setInviteOpen((o) => !o)}
        >
          <Text style={styles.inviteTitle}>{t("community.invite_title")}</Text>
          <Text style={styles.inviteChevron}>{inviteOpen ? "▾" : "▸"}</Text>
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
              onPress={() =>
                router.push(
                  `/(tabs)/community/${encodeURIComponent(r.username)}`,
                )
              }
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
  btnDisabled: { opacity: 0.45 },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: colors.danger, fontSize: 14 },
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
  inviteChevron: { fontSize: 16, color: colors.muted, marginLeft: 8 },
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
