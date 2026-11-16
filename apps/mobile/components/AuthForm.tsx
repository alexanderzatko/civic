import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { MeLogo } from "@/components/MeLogo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { isAppleAuthAvailable } from "@/lib/social-auth";
import { t } from "@/lib/i18n";

type Mode = "login" | "register";

function LegalAgreeLine({ preface }: { preface: string }) {
  return (
    <Text style={styles.legal}>
      {preface}{" "}
      <Text
        style={styles.legalLink}
        onPress={() => router.push("/(auth)/terms")}
      >
        {t("auth.terms")}
      </Text>
      {" · "}
      <Text
        style={styles.legalLink}
        onPress={() => router.push("/(auth)/privacy")}
      >
        {t("auth.privacy")}
      </Text>
    </Text>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  useEffect(() => {
    let cancelled = false;
    void isAppleAuthAvailable().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(
    provider: "google" | "apple",
    action: () => Promise<boolean>,
  ) {
    setError(null);
    setBusy(provider);
    try {
      const ok = await action();
      if (ok) {
        router.replace("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error_generic"));
    } finally {
      setBusy(null);
    }
  }

  const title =
    mode === "login" ? t("auth.login_title") : t("auth.register_title");
  const busyAny = busy !== null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <MeLogo size={48} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {mode === "login" ? (
        <Text style={styles.subtitle}>{t("auth.login_subtitle")}</Text>
      ) : (
        <View style={styles.disclosure}>
          <Text style={styles.disclosureBody}>
            {t("auth.register_rovas_disclosure_before")}
            <Text style={styles.disclosureBold}>
              {t("auth.register_rovas_disclosure_name")}
            </Text>
            {t("auth.register_rovas_disclosure_after")}
          </Text>
          <LegalAgreeLine preface={t("auth.legal_register")} />
        </View>
      )}

      <Pressable
        style={[styles.googleBtn, busyAny && styles.disabled]}
        disabled={busyAny}
        onPress={() => void run("google", signInWithGoogle)}
      >
        {busy === "google" ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.googleBtnText}>{t("auth.continue_google")}</Text>
        )}
      </Pressable>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === "register"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleBtn}
          onPress={() => {
            if (busyAny) return;
            void run("apple", signInWithApple);
          }}
        />
      ) : null}

      {busyAny ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.busyText}>{t("auth.signing_in")}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

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

      {mode === "login" ? (
        <LegalAgreeLine preface={t("auth.legal_login")} />
      ) : null}
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
  disclosure: { gap: 16 },
  disclosureBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  disclosureBold: { fontWeight: "700", color: colors.ink },
  googleBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  googleBtnText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  appleBtn: {
    width: "100%",
    height: 48,
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
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 12 },
  switchLine: { textAlign: "center", color: colors.ink, fontSize: 14 },
  switchLink: { color: colors.brandSoft, fontWeight: "700" },
  legal: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  legalLink: { color: colors.brandSoft, fontWeight: "600" },
});
