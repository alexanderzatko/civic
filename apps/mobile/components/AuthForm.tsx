import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { FacebookIcon } from "@/components/FacebookIcon";
import { GoogleIcon } from "@/components/GoogleIcon";
import { MeLogo } from "@/components/MeLogo";
import { OsmLogo } from "@/components/OsmLogo";
import { RovasLogo } from "@/components/RovasLogo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRovasPasswordResetUrl } from "@/lib/legal-urls";
import { setIdpAuthReturnPath } from "@/lib/oauth-browser";
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

type SocialBusy =
  | "google"
  | "apple"
  | "facebook"
  | "nabezky"
  | "openstreetmap"
  | "password"
  | null;

export function AuthForm({ mode }: { mode: Mode }) {
  const {
    signInWithGoogle,
    signInWithApple,
    beginFacebookSignIn,
    facebookPending,
    clearFacebookPending,
    completeFacebookSignIn,
    signInWithNabezky,
    beginOpenStreetMapSignIn,
    osmPending,
    clearOsmPending,
    completeOpenStreetMapSignIn,
    signInWithPassword,
    registerWithPassword,
  } = useAuth();
  const [busy, setBusy] = useState<SocialBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  const [login, setLogin] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  /** After OSM / Facebook OAuth when the IdP omits email. */
  const [idpEmail, setIdpEmail] = useState("");
  const emailPending = facebookPending ?? osmPending;
  const emailPendingKind: "facebook" | "openstreetmap" | null = facebookPending
    ? "facebook"
    : osmPending
      ? "openstreetmap"
      : null;

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
    provider: Exclude<SocialBusy, "password" | null>,
    action: () => Promise<boolean>,
  ) {
    setError(null);
    setBusy(provider);
    setIdpAuthReturnPath(
      mode === "register" ? "/(auth)/register" : "/(auth)/login",
    );
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

  async function runFacebook() {
    setError(null);
    setBusy("facebook");
    setIdpAuthReturnPath(
      mode === "register" ? "/(auth)/register" : "/(auth)/login",
    );
    try {
      const result = await beginFacebookSignIn();
      if (result === "signed_in") {
        if (mode === "register") {
          await markUsernameHintPending();
        }
        await afterSuccess(mode === "register");
        return;
      }
      if (result) {
        setIdpEmail("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error_generic"));
    } finally {
      setBusy(null);
    }
  }

  async function runOpenStreetMap() {
    setError(null);
    setBusy("openstreetmap");
    setIdpAuthReturnPath(
      mode === "register" ? "/(auth)/register" : "/(auth)/login",
    );
    try {
      const result = await beginOpenStreetMapSignIn();
      if (result === "signed_in") {
        if (mode === "register") {
          await markUsernameHintPending();
        }
        await afterSuccess(mode === "register");
        return;
      }
      if (result) {
        setIdpEmail("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error_generic"));
    } finally {
      setBusy(null);
    }
  }

  async function runIdpEmailComplete() {
    if (!emailPending || !emailPendingKind) return;
    const trimmed = idpEmail.trim();
    if (!trimmed.includes("@")) {
      setError(t("auth.error_email_invalid"));
      return;
    }
    setError(null);
    setBusy(emailPendingKind);
    try {
      const ok =
        emailPendingKind === "facebook"
          ? await completeFacebookSignIn(emailPending.pendingToken, trimmed)
          : await completeOpenStreetMapSignIn(
              emailPending.pendingToken,
              trimmed,
            );
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

      <View style={styles.disclosure}>
        <Text style={styles.subtitle}>
          {t("auth.rovas_disclosure_before")}
          <RovasLogo size={14} style={styles.inlineRovasLogo} />
          <Text style={styles.disclosureBold}>
            {t("auth.rovas_disclosure_name")}
          </Text>
          {t("auth.rovas_disclosure_after")}
        </Text>
        {mode === "register" ? (
          <LegalAgreeLine preface={t("auth.legal_register")} />
        ) : null}
      </View>

      {emailPending && emailPendingKind ? (
        <View style={styles.osmEmailBox}>
          <Text style={styles.osmEmailTitle}>
            {t(
              emailPendingKind === "facebook"
                ? "auth.facebook_email_title"
                : "auth.osm_email_title",
            )}
          </Text>
          <Text style={styles.osmEmailBody}>
            {emailPending.displayName
              ? t(
                  emailPendingKind === "facebook"
                    ? "auth.facebook_email_body_named"
                    : "auth.osm_email_body_named",
                ).replace("{name}", emailPending.displayName)
              : t(
                  emailPendingKind === "facebook"
                    ? "auth.facebook_email_body"
                    : "auth.osm_email_body",
                )}
          </Text>
          <TextInput
            style={styles.input}
            value={idpEmail}
            onChangeText={setIdpEmail}
            placeholder={t("auth.email_placeholder")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busyAny}
          />
          <Pressable
            style={[styles.submitBtn, busyAny && styles.disabled]}
            disabled={busyAny}
            onPress={() => void runIdpEmailComplete()}
          >
            {busy === emailPendingKind ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {t(
                  emailPendingKind === "facebook"
                    ? "auth.facebook_email_continue"
                    : "auth.osm_email_continue",
                )}
              </Text>
            )}
          </Pressable>
          <Pressable
            disabled={busyAny}
            onPress={() => {
              clearFacebookPending();
              clearOsmPending();
              setIdpEmail("");
              setError(null);
            }}
          >
            <Text style={styles.forgotLink}>{t("common.close")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
      <View style={styles.idpIconRow}>
        <Pressable
          style={[styles.idpIconBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runSocial("google", signInWithGoogle)}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continue_google")}
        >
          {busy === "google" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <GoogleIcon size={28} />
          )}
        </Pressable>
        {appleAvailable ? (
          <Pressable
            style={[styles.idpIconBtn, busyAny && styles.disabled]}
            disabled={busyAny}
            onPress={() => void runSocial("apple", signInWithApple)}
            accessibilityRole="button"
            accessibilityLabel={t("auth.continue_apple")}
          >
            {busy === "apple" ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <MaterialCommunityIcons name="apple" size={28} color={colors.ink} />
            )}
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.idpIconBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runFacebook()}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continue_facebook")}
        >
          {busy === "facebook" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <FacebookIcon size={28} />
          )}
        </Pressable>
        <Pressable
          style={[styles.idpIconBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runSocial("nabezky", signInWithNabezky)}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continue_nabezky")}
        >
          {busy === "nabezky" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Image
              source={require("../assets/images/nabezky.png")}
              style={styles.idpIcon}
              resizeMode="contain"
            />
          )}
        </Pressable>
        <Pressable
          style={[styles.idpIconBtn, busyAny && styles.disabled]}
          disabled={busyAny}
          onPress={() => void runOpenStreetMap()}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continue_openstreetmap")}
        >
          {busy === "openstreetmap" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <OsmLogo size={32} />
          )}
        </Pressable>
      </View>

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
        </>
      )}

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
  inlineRovasLogo: {
    width: 14,
    height: 14,
    marginHorizontal: 3,
    transform: [{ translateY: 2 }],
  },
  disclosure: { gap: 16 },
  disclosureBold: { fontWeight: "700", color: colors.ink },
  /** Icon-only IdP row (Google / Apple / FB / Nabezky / OSM). */
  idpIconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 48,
  },
  idpIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  idpIcon: {
    width: 32,
    height: 32,
    borderRadius: 3,
  },
  osmEmailBox: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  osmEmailTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  osmEmailBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
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
