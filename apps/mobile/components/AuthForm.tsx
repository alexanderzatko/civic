import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MeLogo } from "@/components/MeLogo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRovasPasswordResetUrl } from "@/lib/legal-urls";
import { PasswordAuthError } from "@/lib/password-auth";
import { seedProfileIdentity } from "@/lib/profile-identity-seed";
import { isAppleAuthAvailable } from "@/lib/social-auth";
import {
  clearUsernameHintPending,
  markUsernameHintPending,
} from "@/lib/username-hint";

type Mode = "login" | "register";

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;
const USERNAME_MAX = 50;
const PASSWORD_MIN = 8;
/** Keep a little air under the focused field when scrolling above the keyboard. */
const FOCUS_SCROLL_PAD = 16;

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
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithPassword,
    registerWithPassword,
  } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | "password" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  const [login, setLogin] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const scrollHostRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const loginRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    void isAppleAuthAvailable().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function afterSuccess(isRegister: boolean) {
    if (isRegister) {
      router.replace("/(tabs)/profile");
    } else {
      router.replace("/");
    }
  }

  async function runSocial(
    provider: "google" | "apple",
    action: () => Promise<boolean>,
  ) {
    setError(null);
    setBusy(provider);
    try {
      const ok = await action();
      if (ok) {
        if (mode === "register") {
          await markUsernameHintPending();
        }
        await afterSuccess(mode === "register");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error_generic"));
    } finally {
      setBusy(null);
    }
  }

  function validatePasswordForm(): string | null {
    if (mode === "login") {
      if (!login.trim() || !password) {
        return t("auth.error_missing_fields");
      }
      return null;
    }
    const u = username.trim();
    if (!u || !email.trim() || !password) {
      return t("auth.error_missing_fields");
    }
    if (u.length > USERNAME_MAX || !USERNAME_RE.test(u)) {
      return t("auth.error_username_invalid");
    }
    if (!email.includes("@")) {
      return t("auth.error_email_invalid");
    }
    if (password.length < PASSWORD_MIN) {
      return t("auth.error_password_short");
    }
    if (password !== passwordConfirm) {
      return t("auth.error_password_mismatch");
    }
    return null;
  }

  async function runPassword() {
    const validationError = validatePasswordForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy("password");
    try {
      if (mode === "register") {
        const chosenUsername = username.trim();
        const ok = await registerWithPassword(
          chosenUsername,
          email.trim(),
          password,
        );
        if (ok) {
          // Seed Profile so the username field is filled before GET /me returns.
          seedProfileIdentity(chosenUsername);
          // Drop any stale social-register tip flag from an earlier Apple/Google
          // signup on this device (SecureStore used to keep it forever).
          await clearUsernameHintPending();
          // Password register: Home, no auto-username tip.
          // Social register still goes to Profile with the tip (runSocial).
          await afterSuccess(false);
        }
      } else {
        const ok = await signInWithPassword(login.trim(), password);
        if (ok) {
          await clearUsernameHintPending();
          await afterSuccess(false);
        }
      }
    } catch (e) {
      if (e instanceof PasswordAuthError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : t("auth.error_generic"));
      }
    } finally {
      setBusy(null);
    }
  }

  const title =
    mode === "login" ? t("auth.login_title") : t("auth.register_title");
  const busyAny = busy !== null;
  const submitLabel =
    mode === "login" ? t("auth.sign_in") : t("auth.create_account");

  return (
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
      <View style={styles.hero}>
        <MeLogo size={48} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {mode === "login" ? (
        <Text style={styles.subtitle}>
          {t("auth.login_subtitle_before")}
          <Text style={styles.disclosureBold}>
            {t("auth.login_subtitle_name")}
          </Text>
          {t("auth.login_subtitle_after")}
        </Text>
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
        onPress={() => void runSocial("google", signInWithGoogle)}
      >
        {busy === "google" ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.googleBtnText}>{t("auth.continue_google")}</Text>
        )}
      </Pressable>

      {appleAvailable ? (
        <Pressable
          style={[styles.appleBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runSocial("apple", signInWithApple)}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continue_apple")}
        >
          {busy === "apple" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.appleBtnInner}>
              <MaterialCommunityIcons name="apple" size={22} color="#fff" />
              <Text style={styles.appleBtnText}>{t("auth.continue_apple")}</Text>
            </View>
          )}
        </Pressable>
      ) : null}

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.or}>{t("auth.or")}</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.fields}>
        {mode === "login" ? (
          <TextInput
            ref={loginRef}
            value={login}
            onChangeText={setLogin}
            placeholder={t("auth.login_placeholder")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            style={styles.input}
            editable={!busyAny}
            accessibilityLabel={t("auth.login_placeholder")}
            onFocus={() => scrollFieldIntoView(loginRef.current)}
          />
        ) : (
          <>
            <TextInput
              ref={usernameRef}
              value={username}
              onChangeText={(text) =>
                setUsername(text.replace(/\s+/g, "").slice(0, USERNAME_MAX))
              }
              placeholder={t("auth.username_placeholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              style={styles.input}
              maxLength={USERNAME_MAX}
              editable={!busyAny}
              accessibilityLabel={t("auth.username_placeholder")}
              onFocus={() => scrollFieldIntoView(usernameRef.current)}
            />
            <Text style={styles.fieldHint}>{t("profile.username_hint")}</Text>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.email_placeholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              style={styles.input}
              editable={!busyAny}
              accessibilityLabel={t("auth.email_placeholder")}
              onFocus={() => scrollFieldIntoView(emailRef.current)}
            />
          </>
        )}

        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder={t("auth.password_placeholder")}
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete={mode === "register" ? "new-password" : "password"}
          textContentType={mode === "register" ? "newPassword" : "password"}
          // Helps iOS Password AutoFill / “Suggest Strong Password” recognize
          // a signup field. Full Save-Password still needs Associated Domains.
          {...(mode === "register" && Platform.OS === "ios"
            ? {
                passwordRules:
                  "minlength: 8; required: lower; required: upper; required: digit;",
              }
            : {})}
          style={styles.input}
          editable={!busyAny}
          accessibilityLabel={t("auth.password_placeholder")}
          onFocus={() => scrollFieldIntoView(passwordRef.current)}
        />

        {mode === "register" ? (
          <TextInput
            ref={passwordConfirmRef}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder={t("auth.password_confirm_placeholder")}
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="new-password"
            textContentType="newPassword"
            {...(Platform.OS === "ios"
              ? {
                  passwordRules:
                    "minlength: 8; required: lower; required: upper; required: digit;",
                }
              : {})}
            style={styles.input}
            editable={!busyAny}
            accessibilityLabel={t("auth.password_confirm_placeholder")}
            onFocus={() => scrollFieldIntoView(passwordConfirmRef.current)}
          />
        ) : null}

        <Pressable
          style={[styles.submitBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runPassword()}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          {busy === "password" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{submitLabel}</Text>
          )}
        </Pressable>

        {mode === "login" ? (
          <Text style={styles.forgotLine}>
            <Text
              style={styles.forgotLink}
              onPress={() => {
                void Linking.openURL(getRovasPasswordResetUrl());
              }}
            >
              {t("auth.forgot_password")}
            </Text>
          </Text>
        ) : null}
      </View>

      {busyAny ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.busyText}>{t("auth.signing_in")}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    backgroundColor: "#000",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  appleBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appleBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  fields: { gap: 10 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    minHeight: 48,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -4,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  forgotLine: { textAlign: "center", marginTop: 2 },
  forgotLink: { color: colors.brandSoft, fontWeight: "600", fontSize: 13 },
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
