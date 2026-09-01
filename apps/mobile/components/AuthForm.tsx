import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { MeLogo } from "@/components/MeLogo";
import { colors } from "@/constants/theme";
import { AuthCodeExpiredError, useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOAuth() {
    setError(null);
    setBusy(true);
    try {
      const ok = await signIn();
      if (ok) {
        router.replace("/(tabs)");
      }
    } catch (e) {
      if (e instanceof AuthCodeExpiredError) {
        setError(t("auth.error_code_expired"));
      } else {
        setError(e instanceof Error ? e.message : t("auth.error_generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "login" ? t("auth.login_title") : t("auth.register_title");
  const subtitle =
    mode === "login" ? t("auth.login_subtitle") : t("auth.register_subtitle");
  const ctaLabel =
    mode === "login" ? t("auth.sign_in") : t("auth.create_account");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <MeLogo size={48} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>

      {mode === "register" ? (
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>{t("auth.rovas_callout_title")}</Text>
          <Text style={styles.calloutBody}>
            {t("auth.rovas_callout_body_before")}
            <Text
              style={styles.calloutLink}
              onPress={() => void Linking.openURL("https://rovas.app")}
            >
              {t("auth.rovas_callout_link")}
            </Text>
            {t("auth.rovas_callout_body_after")}
          </Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryBtn, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void startOAuth()}
      >
        <Text style={styles.primaryBtnText}>{ctaLabel}</Text>
      </Pressable>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.busyText}>{t("auth.opening_browser")}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {mode === "login" ? (
        <View style={styles.callout}>
          <Text style={styles.calloutBody}>{t("auth.pkce_hint")}</Text>
        </View>
      ) : null}

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.or}>{t("auth.or")}</Text>
        <View style={styles.divider} />
      </View>

      {mode === "login" ? (
        <Text style={styles.switchLine}>
          {t("auth.no_account")}{" "}
          <Text
            style={styles.switchLink}
            onPress={() => router.push("/(auth)/register")}
          >
            {t("auth.register_link")}
          </Text>
        </Text>
      ) : (
        <Text style={styles.switchLine}>
          {t("auth.have_account")}{" "}
          <Text
            style={styles.switchLink}
            onPress={() => router.push("/(auth)/login")}
          >
            {t("auth.login_link")}
          </Text>
        </Text>
      )}

      <Text style={styles.legal}>
        {mode === "login" ? t("auth.legal_login") : t("auth.legal_register")}{" "}
        <Text
          style={styles.legalLink}
          onPress={() => void Linking.openURL("https://rovas.app")}
        >
          {t("auth.terms")}
        </Text>
        {" · "}
        <Text
          style={styles.legalLink}
          onPress={() => void Linking.openURL("https://rovas.app")}
        >
          {t("auth.privacy")}
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    paddingBottom: 48,
    alignItems: "stretch",
  },
  hero: { alignItems: "center", gap: 8 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: { opacity: 0.55 },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  busyText: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center" },
  callout: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  calloutTitle: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  calloutBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  calloutLink: { color: colors.brandSoft, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 12 },
  switchLine: { textAlign: "center", color: colors.ink, fontSize: 14 },
  switchLink: { color: colors.brandSoft, fontWeight: "700" },
  legal: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  legalLink: { color: colors.brandSoft, fontWeight: "600" },
});
