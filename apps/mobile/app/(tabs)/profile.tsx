import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type MeSourcesShare,
  type MeritHistoryItem,
  type ReceiptHistoryRetention,
} from "@civic/shared";
import { MeritHistoryList } from "@/components/MeritHistoryList";
import { SectionTabs } from "@/components/SectionTabs";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMe, fetchMeritHistory, updateMeProfile } from "@/lib/api";
import { useChronPreference } from "@/lib/chron-preference";
import { visibleDisplayName } from "@/lib/format-member-handle";
import { CIVIC_LOCALES, type Locale, t } from "@/lib/i18n";
import { getPrivacyUrl } from "@/lib/legal-urls";
import { useLocale } from "@/lib/locale";
import { useMeSourcesPreference } from "@/lib/me-sources-preference";
import { useReceiptHistoryPreference } from "@/lib/receipt-history-preference";
import { useMeritsAutoRefresh } from "@/lib/useMeritsAutoRefresh";
import {
  dismissUsernameHint,
  hasUsernameHintPending,
  isFreshAccount,
  isUsernameHintDismissed,
} from "@/lib/username-hint";

const ME_SOURCES_OPTIONS: MeSourcesShare[] = [
  "everyone",
  "reciprocal",
  "aggregate",
];

const PAGE_SIZE = 20;
const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;
const USERNAME_MAX = 50;
const DISPLAY_NAME_MAX = 200;

type ProfileTab = "user" | "settings" | "history";

const LOCALE_LABELS: Record<Locale, string> = {
  sk: "Slovenčina",
  en: "English",
};

function formatChr(n: number): string {
  return Math.round(n).toLocaleString("sk-SK");
}

function retentionStatusLabel(
  retention: ReceiptHistoryRetention | null,
): string {
  if (retention === "keep") return t("profile.taxes_status_keep");
  if (retention === "policy") return t("profile.taxes_status_policy");
  return t("profile.taxes_status_unset");
}

function editableRealName(
  username: string | null,
  displayName: string | null,
): string {
  if (!username) return "";
  return visibleDisplayName({ username, displayName }) ?? "";
}

export default function ProfileScreen() {
  const { status, signOut } = useAuth();
  const { locale, setAppLocale } = useLocale();
  const { allowChrons, setAllowChrons } = useChronPreference();
  const {
    retention,
    ready: retentionReady,
    setRetention,
  } = useReceiptHistoryPreference();
  const {
    share: meSourcesShare,
    ready: meSourcesReady,
    setShare: setMeSourcesShare,
  } = useMeSourcesPreference();
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [meSourcesSaving, setMeSourcesSaving] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("user");
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRealName, setEditRealName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [showUsernameAutoHint, setShowUsernameAutoHint] = useState(false);
  const [rovasUid, setRovasUid] = useState<string | null>(null);
  const [totalChr, setTotalChr] = useState<number | null>(null);
  const [items, setItems] = useState<MeritHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  const profileTabs = [
    { id: "user" as const, label: t("profile.tab_user") },
    { id: "settings" as const, label: t("profile.tab_settings") },
    { id: "history" as const, label: t("profile.tab_history") },
  ];

  const applyMeIdentity = useCallback(
    (name: string, nextDisplay: string | null) => {
      setUsername(name);
      setDisplayName(nextDisplay);
      setEditUsername(name);
      setEditRealName(editableRealName(name, nextDisplay));
    },
    [],
  );

  const loadFirstPage = useCallback(async () => {
    if (status !== "signedIn") return;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const page = await fetchMeritHistory({ limit: PAGE_SIZE, offset: 0 });
      setItems(page.items);
      setTotal(page.total);
    } catch {
      setItems([]);
      setTotal(0);
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "signedIn") {
      setUsername(null);
      setDisplayName(null);
      setEditUsername("");
      setEditRealName("");
      setTotalChr(null);
      setRovasUid(null);
      setShowUsernameAutoHint(false);
      setItems([]);
      setTotal(0);
      setHistoryError(false);
      setProfileTab("user");
      return;
    }
    let cancelled = false;
    void (async () => {
      const pending = await hasUsernameHintPending();
      try {
        const me = await fetchMe();
        if (cancelled) return;
        const name = me.username ?? me.rovas_uid;
        const uid = me.rovas_uid;
        applyMeIdentity(name, me.display_name ?? null);
        setRovasUid(uid);
        setTotalChr(typeof me.total_chr === "number" ? me.total_chr : null);
        const dismissed = await isUsernameHintDismissed(uid);
        const fresh = isFreshAccount(me.created);
        setShowUsernameAutoHint(!dismissed && (pending || fresh));
      } catch {
        if (!cancelled) {
          setUsername(null);
          setDisplayName(null);
          setEditUsername("");
          setEditRealName("");
          setTotalChr(null);
          setRovasUid(null);
          setShowUsernameAutoHint(pending);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMeIdentity, status]);

  useMeritsAutoRefresh(loadFirstPage);

  const localeRef = useRef(locale);
  useEffect(() => {
    if (status !== "signedIn") {
      localeRef.current = locale;
      return;
    }
    if (localeRef.current === locale) return;
    localeRef.current = locale;
    void loadFirstPage();
  }, [locale, loadFirstPage, status]);

  const onLoadMore = useCallback(() => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    void fetchMeritHistory({ limit: PAGE_SIZE, offset: items.length })
      .then((page) => {
        setItems((prev) => {
          const seen = new Set(prev.map((r) => r.disbursement_nid));
          return [
            ...prev,
            ...page.items.filter((r) => !seen.has(r.disbursement_nid)),
          ];
        });
        setTotal(page.total);
      })
      .catch(() => {
        setHistoryError(true);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [items.length, loadingMore, total]);

  const applyRetention = useCallback(
    async (value: ReceiptHistoryRetention) => {
      setRetentionSaving(true);
      try {
        const result = await setRetention(value);
        if (value === "policy" && result.scrubbed_claims > 0) {
          Alert.alert(
            t("profile.taxes_scrubbed_title"),
            t("profile.taxes_scrubbed_body").replace(
              "{{count}}",
              String(result.scrubbed_claims),
            ),
          );
        }
      } catch {
        Alert.alert(
          t("profile.taxes_save_error_title"),
          t("profile.taxes_save_error_body"),
        );
      } finally {
        setRetentionSaving(false);
      }
    },
    [setRetention],
  );

  const onSelectMeSourcesShare = useCallback(
    (value: MeSourcesShare) => {
      if (!meSourcesReady || meSourcesSaving || value === meSourcesShare) {
        return;
      }
      setMeSourcesSaving(true);
      void setMeSourcesShare(value)
        .catch(() => {
          Alert.alert(
            t("profile.me_sources_save_error_title"),
            t("profile.me_sources_save_error_body"),
          );
        })
        .finally(() => {
          setMeSourcesSaving(false);
        });
    },
    [meSourcesReady, meSourcesSaving, meSourcesShare, setMeSourcesShare],
  );

  const onToggleKeepReceipts = useCallback(
    (keep: boolean) => {
      if (!retentionReady || retentionSaving) return;
      const value: ReceiptHistoryRetention = keep ? "keep" : "policy";
      if (retention === value) return;
      if (retention === "keep" && value === "policy") {
        Alert.alert(
          t("profile.taxes_irreversible_title"),
          t("profile.taxes_irreversible_body"),
          [
            { text: t("common.back"), style: "cancel" },
            {
              text: t("profile.taxes_irreversible_confirm"),
              style: "destructive",
              onPress: () => {
                void applyRetention("policy");
              },
            },
          ],
        );
        return;
      }
      void applyRetention(value);
    },
    [applyRetention, retention, retentionReady, retentionSaving],
  );

  const onSaveProfile = useCallback(() => {
    if (profileSaving || !username) return;
    const nextUsername = editUsername.trim();
    if (
      !nextUsername ||
      nextUsername.length > USERNAME_MAX ||
      !USERNAME_RE.test(nextUsername)
    ) {
      Alert.alert(
        t("profile.save_error_title"),
        t("profile.save_error_invalid"),
      );
      return;
    }
    const nextReal = editRealName.trim().slice(0, DISPLAY_NAME_MAX);
    const currentReal = editableRealName(username, displayName);
    const usernameChanged = nextUsername !== username;
    const realChanged = nextReal !== currentReal;
    if (!usernameChanged && !realChanged) {
      return;
    }

    setProfileSaving(true);
    void updateMeProfile({
      ...(usernameChanged ? { username: nextUsername } : {}),
      ...(realChanged ? { display_name: nextReal.length ? nextReal : null } : {}),
    })
      .then((result) => {
        applyMeIdentity(result.username, result.display_name);
        setShowUsernameAutoHint(false);
        if (rovasUid) {
          void dismissUsernameHint(rovasUid);
        }
        Alert.alert(
          t("profile.save_success_title"),
          t("profile.save_success_body"),
        );
      })
      .catch((err: Error & { status?: number }) => {
        const statusCode = err.status;
        const body =
          statusCode === 409
            ? t("profile.save_error_taken")
            : statusCode === 422
              ? t("profile.save_error_invalid")
              : t("profile.save_error_body");
        Alert.alert(t("profile.save_error_title"), body);
      })
      .finally(() => {
        setProfileSaving(false);
      });
  }, [
    applyMeIdentity,
    displayName,
    editRealName,
    editUsername,
    profileSaving,
    rovasUid,
    username,
  ]);

  const languageSwitcher = (
    <View style={styles.langBlock}>
      <Text style={styles.langLabel}>{t("profile.language")}</Text>
      <View style={styles.langRow}>
        {CIVIC_LOCALES.map((code) => {
          const selected = locale === code;
          return (
            <Pressable
              key={code}
              style={[styles.langBtn, selected && styles.langBtnSelected]}
              onPress={() => {
                void setAppLocale(code);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.langBtnText,
                  selected && styles.langBtnTextSelected,
                ]}
              >
                {LOCALE_LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (status === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (status === "signedIn") {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTabs
          tabs={profileTabs}
          value={profileTab}
          onChange={setProfileTab}
        >
          {profileTab === "user" ? (
            <View style={styles.panel}>
              <Text style={styles.userLine}>
                {t("profile.signed_in")}
                {username ? ` · @${username}` : ""}
              </Text>

              {showUsernameAutoHint ? (
                <Text style={styles.autoUsernameHint}>
                  {t("profile.username_auto_hint")}
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>{t("profile.username")}</Text>
              <TextInput
                value={editUsername}
                onChangeText={(text) =>
                  setEditUsername(
                    text.replace(/\s+/g, "").slice(0, USERNAME_MAX),
                  )
                }
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                style={styles.input}
                maxLength={USERNAME_MAX}
                editable={!profileSaving}
                accessibilityLabel={t("profile.username")}
              />
              <Text style={styles.prefHint}>{t("profile.username_hint")}</Text>

              <Text style={styles.fieldLabel}>{t("profile.real_name")}</Text>
              <TextInput
                value={editRealName}
                onChangeText={(text) =>
                  setEditRealName(text.slice(0, DISPLAY_NAME_MAX))
                }
                autoCapitalize="words"
                style={styles.input}
                maxLength={DISPLAY_NAME_MAX}
                editable={!profileSaving}
                accessibilityLabel={t("profile.real_name")}
              />
              <Text style={styles.prefHint}>{t("profile.real_name_hint")}</Text>

              <Pressable
                style={[styles.btn, profileSaving && styles.btnDisabled]}
                onPress={onSaveProfile}
                disabled={profileSaving}
                accessibilityRole="button"
              >
                {profileSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>{t("profile.save")}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.signOutBtn}
                onPress={() => {
                  void signOut();
                }}
              >
                <Text style={styles.signOutBtnText}>{t("profile.sign_out")}</Text>
              </Pressable>
            </View>
          ) : null}

          {profileTab === "settings" ? (
            <View style={styles.panel}>
              {languageSwitcher}

              <View style={styles.pillbox}>
                <Text style={styles.pillLabel}>
                  {t("profile.chrons_section")}
                </Text>
                {totalChr != null ? (
                  <Text style={styles.balanceChr}>
                    {t("profile.chrons_balance")}: {formatChr(totalChr)} CHR
                  </Text>
                ) : null}
                <View style={styles.prefRow}>
                  <Text style={styles.prefLabel}>
                    {t("profile.allow_chrons")}
                  </Text>
                  <Switch
                    value={allowChrons}
                    onValueChange={(checked) => {
                      void setAllowChrons(checked);
                    }}
                    trackColor={{ false: colors.border, true: colors.brandSoft }}
                    accessibilityRole="switch"
                    accessibilityLabel={t("profile.allow_chrons")}
                  />
                </View>
                <Text style={styles.prefHint}>
                  {t("profile.allow_chrons_hint")}
                </Text>
              </View>

              <View style={styles.pillbox}>
                <Text style={styles.pillLabel}>
                  {t("profile.me_sources_section")}
                </Text>
                <Text style={styles.prefHint}>
                  {t("profile.me_sources_hint")}
                </Text>
                {!meSourcesReady || meSourcesSaving ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <View style={styles.meSourcesOptions}>
                    {ME_SOURCES_OPTIONS.map((option) => {
                      const selected = meSourcesShare === option;
                      return (
                        <Pressable
                          key={option}
                          style={[
                            styles.meSourcesOption,
                            selected && styles.meSourcesOptionSelected,
                          ]}
                          onPress={() => onSelectMeSourcesShare(option)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.meSourcesOptionTitle,
                              selected && styles.meSourcesOptionTitleSelected,
                            ]}
                          >
                            {t(`profile.me_sources_${option}_title`)}
                          </Text>
                          <Text style={styles.meSourcesOptionBody}>
                            {t(`profile.me_sources_${option}_body`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.pillbox}>
                <Text style={styles.pillLabel}>
                  {t("profile.taxes_section")}
                </Text>
                <Text style={styles.prefHint}>{t("profile.taxes_hint")}</Text>
                <View style={styles.prefRow}>
                  <Text style={styles.prefLabel}>
                    {t("profile.taxes_keep_switch")}
                  </Text>
                  {!retentionReady || retentionSaving ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <Switch
                      value={retention === "keep"}
                      onValueChange={onToggleKeepReceipts}
                      trackColor={{
                        false: colors.border,
                        true: colors.brandSoft,
                      }}
                      accessibilityRole="switch"
                      accessibilityLabel={t("profile.taxes_keep_switch")}
                    />
                  )}
                </View>
                <Text style={styles.prefHint}>
                  {t("profile.taxes_status").replace(
                    "{{status}}",
                    retentionStatusLabel(retention),
                  )}
                </Text>
                <Pressable
                  onPress={() => void Linking.openURL(getPrivacyUrl())}
                  accessibilityRole="link"
                  hitSlop={6}
                >
                  <Text style={styles.privacyLink}>
                    {t("profile.taxes_privacy_link")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {profileTab === "history" ? (
            <MeritHistoryList
              items={items}
              total={total}
              loading={historyLoading}
              loadingMore={loadingMore}
              error={historyError}
              onLoadMore={onLoadMore}
            />
          ) : null}
        </SectionTabs>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.body}>{t("profile.signed_out")}</Text>
      {languageSwitcher}
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("home.sign_in")}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 24, justifyContent: "center" },
  container: { padding: 24, gap: 16, paddingBottom: 48 },
  panel: { gap: 12 },
  userLine: { color: colors.ink, fontWeight: "600", fontSize: 16, lineHeight: 22 },
  autoUsernameHint: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  body: { color: colors.muted, lineHeight: 22 },
  balanceChr: { fontSize: 15, fontWeight: "400", color: colors.ink, lineHeight: 22 },
  fieldLabel: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  pillbox: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  pillLabel: { fontWeight: "700", color: colors.ink, fontSize: 15 },
  langBlock: { gap: 8 },
  langLabel: { color: colors.ink, fontWeight: "600" },
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  langBtnSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  langBtnText: { color: colors.ink, fontWeight: "600" },
  langBtnTextSelected: { color: "#fff" },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prefLabel: { flex: 1, color: colors.ink, fontWeight: "600", lineHeight: 20 },
  prefHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  meSourcesOptions: { gap: 8 },
  meSourcesOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: colors.bg,
  },
  meSourcesOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(11, 61, 46, 0.08)",
  },
  meSourcesOptionTitle: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
  },
  meSourcesOptionTitleSelected: { color: colors.brand },
  meSourcesOptionBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  privacyLink: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
    lineHeight: 18,
  },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700" },
  signOutBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  signOutBtnText: { color: colors.ink, fontWeight: "700" },
});
