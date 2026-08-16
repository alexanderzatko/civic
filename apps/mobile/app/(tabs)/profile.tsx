import { useEffect, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMe } from "@/lib/api";
import { CIVIC_LOCALES, type Locale, t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

const LOCALE_LABELS: Record<Locale, string> = {
  sk: "Slovenčina",
  en: "English",
};

export default function ProfileScreen() {
  const { status, signOut } = useAuth();
  const { locale, setAppLocale } = useLocale();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") {
      setUsername(null);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUsername(me.username ?? me.rovas_uid);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

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
      <View style={styles.container}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (status === "signedIn") {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Civic</Text>
        <Text style={styles.body}>{t("profile.signed_in")}</Text>
        {username ? (
          <Text style={styles.meta}>
            {t("profile.username")}: @{username}
          </Text>
        ) : null}
        {languageSwitcher}
        <Pressable
          style={styles.btn}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.btnText}>{t("profile.sign_out")}</Text>
        </Pressable>
      </View>
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
  container: { flex: 1, padding: 24, gap: 16 },
  brand: { fontSize: 24, fontWeight: "700", color: colors.brand },
  body: { color: colors.muted, lineHeight: 22 },
  meta: { color: colors.ink, fontWeight: "600" },
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
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
