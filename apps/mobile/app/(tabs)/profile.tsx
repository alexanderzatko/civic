import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { displayMerits, type MeritHistoryItem } from "@civic/shared";
import { MeritHistoryList } from "@/components/MeritHistoryList";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMe, fetchMeritHistory } from "@/lib/api";
import { useChronPreference } from "@/lib/chron-preference";
import { CIVIC_LOCALES, type Locale, t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { useMeritsAutoRefresh } from "@/lib/useMeritsAutoRefresh";

const PAGE_SIZE = 20;

const LOCALE_LABELS: Record<Locale, string> = {
  sk: "Slovenčina",
  en: "English",
};

function formatMe(n: number): string {
  return displayMerits(n).toLocaleString("sk-SK");
}

function formatChr(n: number): string {
  return Math.round(n).toLocaleString("sk-SK");
}

export default function ProfileScreen() {
  const { status, signOut } = useAuth();
  const { locale, setAppLocale } = useLocale();
  const { allowChrons, setAllowChrons } = useChronPreference();
  const [username, setUsername] = useState<string | null>(null);
  const [totalMe, setTotalMe] = useState<number | null>(null);
  const [totalChr, setTotalChr] = useState<number | null>(null);
  const [items, setItems] = useState<MeritHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState(false);

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
      setTotalMe(null);
      setTotalChr(null);
      setItems([]);
      setTotal(0);
      setHistoryError(false);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUsername(me.username ?? me.rovas_uid);
        setTotalMe(typeof me.total_me === "number" ? me.total_me : null);
        setTotalChr(typeof me.total_chr === "number" ? me.total_chr : null);
      })
      .catch(() => {
        if (!cancelled) {
          setUsername(null);
          setTotalMe(null);
          setTotalChr(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>Civic</Text>
        <Text style={styles.body}>{t("profile.signed_in")}</Text>
        {username ? (
          <Text style={styles.meta}>
            {t("profile.username")}: @{username}
          </Text>
        ) : null}
        {totalMe != null ? (
          <Text style={styles.balance}>
            {formatMe(totalMe)} {t("common.me")}
          </Text>
        ) : null}
        {totalChr != null && totalChr > 0 ? (
          <Text style={styles.balanceChr}>
            {t("profile.chrons_balance")}: {formatChr(totalChr)} CHR
          </Text>
        ) : null}
        {languageSwitcher}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>{t("profile.allow_chrons")}</Text>
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
        <Text style={styles.prefHint}>{t("profile.allow_chrons_hint")}</Text>
        <Pressable
          style={styles.btn}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.btnText}>{t("profile.sign_out")}</Text>
        </Pressable>
        <MeritHistoryList
          items={items}
          total={total}
          loading={historyLoading}
          loadingMore={loadingMore}
          error={historyError}
          onLoadMore={onLoadMore}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Civic</Text>
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
  brand: { fontSize: 24, fontWeight: "700", color: colors.brand },
  body: { color: colors.muted, lineHeight: 22 },
  meta: { color: colors.ink, fontWeight: "600" },
  balance: { fontSize: 22, fontWeight: "700", color: colors.ink },
  balanceChr: { fontSize: 18, fontWeight: "600", color: colors.muted },
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
  prefHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: -8 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
