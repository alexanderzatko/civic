import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Linking from "expo-linking";
import { AppState, Platform } from "react-native";
import {
  AuthRequest,
  TokenResponse,
  TokenTypeHint,
  exchangeCodeAsync,
  revokeAsync,
  type DiscoveryDocument,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  clearPendingOAuth,
  clearTokens,
  loadPendingOAuth,
  loadTokens,
  savePendingOAuth,
  saveTokens,
  type PendingOAuth,
  type StoredTokens,
} from "@/lib/auth-storage";
import { setAccessTokenGetter, setUnauthorizedHandler } from "@/lib/api";
import {
  getOAuthClientId,
  getOAuthRedirectUri,
  getRovasDiscovery,
  OAUTH_SCOPES,
} from "@/lib/oauth";
import { waitForOAuthRedirect } from "@/lib/oauth-browser";
import { getLocale } from "@/lib/i18n";
import {
  registerCivicPushToken,
  unregisterCivicPushToken,
} from "@/lib/push-notifications";
import {
  clearPendingVerificationsState,
  refreshPendingVerifications,
} from "@/lib/pending-verifications";
import {
  clearPendingCommentNoticesState,
  refreshPendingCommentNotices,
} from "@/lib/pending-comment-notices";
import {
  clearTrustedNotifyState,
  refreshTrustedNotify,
} from "@/lib/trusted-notify";
import { capture, resetAnalytics } from "@/lib/analytics";
import { resetSpotlightDismiss } from "@/lib/spotlight-dismiss";
import {
  beginFacebookBrowser,
  beginOpenStreetMapBrowser,
  completeFacebookEmail,
  completeOpenStreetMapEmail,
  signInWithNabezkyBrowser,
  type FacebookPendingAuth,
  type OsmPendingAuth,
} from "@/lib/idp-oauth";
import {
  SocialAuthCancelledError,
  signInWithAppleNative,
  signInWithGoogleNative,
} from "@/lib/social-auth";
import {
  registerWithPasswordNative,
  signInWithPasswordNative,
} from "@/lib/password-auth";

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = "loading" | "signedOut" | "signedIn";

/** Which anonymous form Rovas should present first after authorize. */
export type OAuthIntent = "login" | "register";

type AuthContextValue = {
  status: AuthStatus;
  accessToken: string | null;
  /** Native Google Sign-In → Civic API → Rovas-minted Bearer tokens. */
  signInWithGoogle: () => Promise<boolean>;
  /** Native Apple Sign-In (iOS) → Civic API → Rovas-minted Bearer tokens. */
  signInWithApple: () => Promise<boolean>;
  /**
   * Facebook Login → signed in or pending email (Meta often omits email).
   * Returns null when cancelled.
   */
  beginFacebookSignIn: () => Promise<"signed_in" | FacebookPendingAuth | null>;
  /** In-progress Facebook email step. */
  facebookPending: FacebookPendingAuth | null;
  clearFacebookPending: () => void;
  completeFacebookSignIn: (
    pendingToken: string,
    email: string,
  ) => Promise<boolean>;
  /** Nabezky OIDC PKCE → Civic API → Rovas-minted Bearer tokens. */
  signInWithNabezky: () => Promise<boolean>;
  /**
   * OpenStreetMap OAuth → signed in (existing HybridAuth link) or pending
   * email collection. Returns null when cancelled.
   */
  beginOpenStreetMapSignIn: () => Promise<"signed_in" | OsmPendingAuth | null>;
  /** In-progress OSM email step (hoisted so deep-link return keeps it). */
  osmPending: OsmPendingAuth | null;
  clearOsmPending: () => void;
  /** Finish OSM sign-in after the user enters an email. */
  completeOpenStreetMapSignIn: (
    pendingToken: string,
    email: string,
  ) => Promise<boolean>;
  /** Username/email + password → Civic API → Rovas-minted Bearer tokens. */
  signInWithPassword: (login: string, password: string) => Promise<boolean>;
  /** Register with username + email + password → mint. */
  registerWithPassword: (
    username: string,
    email: string,
    password: string,
  ) => Promise<boolean>;
  /**
   * Legacy: Rovas Authorization Code + PKCE in the system browser.
   * Kept as fallback; primary UI uses Google / Apple / password.
   */
  signIn: (intent?: OAuthIntent) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Fresh access token (refreshes when needed). */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Thrown when the OAuth authorization code is stale or already used. */
export class AuthCodeExpiredError extends Error {
  constructor() {
    super("AUTH_CODE_EXPIRED");
    this.name = "AuthCodeExpiredError";
  }
}

function toStored(token: TokenResponse): StoredTokens {
  return token.getRequestConfig();
}

function mergeRefreshedTokens(
  current: StoredTokens,
  refreshed: TokenResponse,
): StoredTokens {
  const stored = toStored(refreshed);
  return {
    ...stored,
    refreshToken: stored.refreshToken ?? current.refreshToken,
  };
}

function isOAuthGrantError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "invalid_grant") return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("invalid_grant") ||
    msg.includes("invalid_token") ||
    msg.includes("revoked") ||
    (msg.includes("authorization code") && msg.includes("expired"))
  );
}

function parseOAuthCallbackCode(url: string, expectedState: string): string {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const state = typeof params.state === "string" ? params.state : undefined;
  const code = typeof params.code === "string" ? params.code : undefined;
  const error =
    typeof params.error === "string"
      ? params.error
      : typeof params.error_description === "string"
        ? params.error_description
        : undefined;

  if (state !== expectedState) {
    throw new Error("OAuth state mismatch");
  }
  if (error) {
    throw new Error(error);
  }
  if (!code) {
    throw new Error("Authorization response missing code");
  }
  return code;
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  discovery: DiscoveryDocument,
): Promise<TokenResponse> {
  try {
    return await exchangeCodeAsync(
      {
        clientId: getOAuthClientId(),
        code,
        redirectUri,
        extraParams: {
          code_verifier: codeVerifier,
        },
      },
      discovery,
    );
  } catch (error) {
    if (isOAuthGrantError(error)) {
      throw new AuthCodeExpiredError();
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [osmPending, setOsmPending] = useState<OsmPendingAuth | null>(null);
  const [facebookPending, setFacebookPending] =
    useState<FacebookPendingAuth | null>(null);
  const tokensRef = useRef<StoredTokens | null>(null);
  tokensRef.current = tokens;
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  const oauthResumeInFlightRef = useRef(false);

  const clearSession = useCallback(async () => {
    void unregisterCivicPushToken().catch(() => undefined);
    clearPendingVerificationsState();
    clearPendingCommentNoticesState();
    clearTrustedNotifyState();
    resetSpotlightDismiss();
    await clearPendingOAuth();
    await clearTokens();
    setTokens(null);
    setOsmPending(null);
    setStatus("signedOut");
    capture("auth_signed_out");
    resetAnalytics();
  }, []);

  const persist = useCallback(async (next: StoredTokens | null) => {
    if (next?.accessToken) {
      resetSpotlightDismiss();
      await saveTokens(next);
      setTokens(next);
      setStatus("signedIn");
      void registerCivicPushToken();
      void refreshPendingVerifications();
      void refreshPendingCommentNotices();
      void refreshTrustedNotify();
    } else {
      await clearSession();
    }
  }, [clearSession]);

  const completeOAuthFromRedirect = useCallback(
    async (url: string, pending: PendingOAuth): Promise<boolean> => {
      if (oauthResumeInFlightRef.current) return false;
      oauthResumeInFlightRef.current = true;
      try {
        const code = parseOAuthCallbackCode(url, pending.state);
        const token = await exchangeAuthorizationCode(
          code,
          pending.codeVerifier,
          pending.redirectUri,
          getRovasDiscovery(),
        );
        await clearPendingOAuth();
        await persist(toStored(token));
        capture("auth_signed_in");
        return true;
      } catch {
        await clearPendingOAuth();
        return false;
      } finally {
        oauthResumeInFlightRef.current = false;
      }
    },
    [persist],
  );

  const resumePendingOAuth = useCallback(async (): Promise<boolean> => {
    const pending = await loadPendingOAuth();
    if (!pending) return false;
    const url = await Linking.getInitialURL();
    if (!url?.startsWith(pending.redirectUri)) return false;
    return completeOAuthFromRedirect(url, pending);
  }, [completeOAuthFromRedirect]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadTokens();
      if (cancelled) return;
      if (stored?.accessToken) {
        setTokens(stored);
        setStatus("signedIn");
        void registerCivicPushToken();
        void refreshPendingVerifications();
        void refreshPendingCommentNotices();
        void refreshTrustedNotify();
        return;
      }

      const resumed = await resumePendingOAuth();
      if (cancelled) return;
      if (!resumed) {
        setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumePendingOAuth]);

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const refreshAccessToken = useCallback(
    async (force = false): Promise<string | null> => {
      const currentTokens = tokensRef.current;
      if (!currentTokens?.accessToken) return null;

      const current = new TokenResponse(currentTokens);
      if (!force && !current.shouldRefresh()) {
        return current.accessToken;
      }
      if (!currentTokens.refreshToken) {
        await persist(null);
        return null;
      }

      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const refreshPromise = (async (): Promise<string | null> => {
        try {
          const refreshed = await current.refreshAsync(
            { clientId: getOAuthClientId() },
            getRovasDiscovery(),
          );
          const stored = mergeRefreshedTokens(currentTokens, refreshed);
          await persist(stored);
          return refreshed.accessToken;
        } catch (error) {
          if (isOAuthGrantError(error)) {
            await persist(null);
          }
          return null;
        } finally {
          refreshInFlightRef.current = null;
        }
      })();

      refreshInFlightRef.current = refreshPromise;
      return refreshPromise;
    },
    [persist],
  );

  const getAccessToken = useCallback(
    () => refreshAccessToken(false),
    [refreshAccessToken],
  );

  useEffect(() => {
    if (status !== "signedIn") return;

    const refreshIfNeeded = () => {
      void refreshAccessToken(false);
    };

    refreshIfNeeded();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshIfNeeded();
    });

    return () => sub.remove();
  }, [refreshAccessToken, status]);

  const signInWithPrompt = useCallback(
    async (request: AuthRequest, discovery: DiscoveryDocument): Promise<boolean> => {
      const redirectUri = request.redirectUri;
      if (!request.codeVerifier) {
        throw new Error("PKCE code_verifier missing from auth request");
      }

      const result = await request.promptAsync(discovery);
      if (result.type !== "success") {
        if (result.type === "error") {
          throw new Error(result.error?.message ?? "OAuth authorization failed");
        }
        return false;
      }

      const code = result.params.code;
      if (!code) {
        throw new Error("Authorization response missing code");
      }

      const token = await exchangeAuthorizationCode(
        code,
        request.codeVerifier,
        redirectUri,
        discovery,
      );
      await persist(toStored(token));
      capture("auth_signed_in");
      return true;
    },
    [persist],
  );

  const signInOnAndroid = useCallback(
    async (request: AuthRequest, discovery: DiscoveryDocument): Promise<boolean> => {
      const redirectUri = request.redirectUri;
      if (!request.codeVerifier) {
        throw new Error("PKCE code_verifier missing from auth request");
      }

      const authUrl = await request.makeAuthUrlAsync(discovery);
      await savePendingOAuth({
        state: request.state,
        codeVerifier: request.codeVerifier,
        redirectUri,
        startedAt: Date.now(),
      });

      try {
        const redirectPromise = waitForOAuthRedirect(redirectUri);
        await WebBrowser.openBrowserAsync(authUrl);
        const returnUrl = await redirectPromise;
        const code = parseOAuthCallbackCode(returnUrl, request.state);
        const token = await exchangeAuthorizationCode(
          code,
          request.codeVerifier,
          redirectUri,
          discovery,
        );
        await persist(toStored(token));
        capture("auth_signed_in");
        return true;
      } finally {
        await clearPendingOAuth();
      }
    },
    [persist],
  );

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const stored = await signInWithGoogleNative();
      await persist(stored);
      capture("auth_signed_in", { provider: "google" });
      return true;
    } catch (err) {
      if (err instanceof SocialAuthCancelledError) return false;
      throw err;
    }
  }, [persist]);

  const signInWithApple = useCallback(async (): Promise<boolean> => {
    try {
      const stored = await signInWithAppleNative();
      await persist(stored);
      capture("auth_signed_in", { provider: "apple" });
      return true;
    } catch (err) {
      if (err instanceof SocialAuthCancelledError) return false;
      throw err;
    }
  }, [persist]);

  const beginFacebookSignIn = useCallback(async () => {
    try {
      const result = await beginFacebookBrowser();
      if (result.kind === "signed_in") {
        setFacebookPending(null);
        await persist(result.tokens);
        capture("auth_signed_in", { provider: "facebook" });
        return "signed_in";
      }
      setOsmPending(null);
      setFacebookPending(result.pending);
      return result.pending;
    } catch (err) {
      if (err instanceof SocialAuthCancelledError) return null;
      throw err;
    }
  }, [persist]);

  const clearFacebookPending = useCallback(() => {
    setFacebookPending(null);
  }, []);

  const completeFacebookSignIn = useCallback(
    async (pendingToken: string, email: string): Promise<boolean> => {
      const stored = await completeFacebookEmail(pendingToken, email);
      await persist(stored);
      setFacebookPending(null);
      capture("auth_signed_in", { provider: "facebook" });
      return true;
    },
    [persist],
  );

  const signInWithNabezky = useCallback(async (): Promise<boolean> => {
    try {
      const stored = await signInWithNabezkyBrowser();
      await persist(stored);
      capture("auth_signed_in", { provider: "nabezky" });
      return true;
    } catch (err) {
      if (err instanceof SocialAuthCancelledError) return false;
      throw err;
    }
  }, [persist]);

  const beginOpenStreetMapSignIn = useCallback(async () => {
    try {
      const result = await beginOpenStreetMapBrowser();
      if (result.kind === "signed_in") {
        setOsmPending(null);
        await persist(result.tokens);
        capture("auth_signed_in", { provider: "openstreetmap" });
        return "signed_in";
      }
      setFacebookPending(null);
      setOsmPending(result.pending);
      return result.pending;
    } catch (err) {
      if (err instanceof SocialAuthCancelledError) return null;
      throw err;
    }
  }, [persist]);

  const clearOsmPending = useCallback(() => {
    setOsmPending(null);
  }, []);

  const completeOpenStreetMapSignIn = useCallback(
    async (pendingToken: string, email: string): Promise<boolean> => {
      const stored = await completeOpenStreetMapEmail(pendingToken, email);
      await persist(stored);
      setOsmPending(null);
      capture("auth_signed_in", { provider: "openstreetmap" });
      return true;
    },
    [persist],
  );

  const signInWithPassword = useCallback(
    async (login: string, password: string): Promise<boolean> => {
      const stored = await signInWithPasswordNative({ login, password });
      await persist(stored);
      capture("auth_signed_in", { provider: "password" });
      return true;
    },
    [persist],
  );

  const registerWithPassword = useCallback(
    async (
      username: string,
      email: string,
      password: string,
    ): Promise<boolean> => {
      const stored = await registerWithPasswordNative({
        username,
        email,
        password,
      });
      await persist(stored);
      capture("auth_signed_in", { provider: "password", intent: "register" });
      return true;
    },
    [persist],
  );

  const signIn = useCallback(
    async (intent: OAuthIntent = "login"): Promise<boolean> => {
      if (Platform.OS === "ios") {
        await WebBrowser.dismissBrowser().catch(() => undefined);
      }
      WebBrowser.maybeCompleteAuthSession();

      const discovery = getRovasDiscovery();
      const redirectUri = getOAuthRedirectUri();
      const request = new AuthRequest({
        clientId: getOAuthClientId(),
        redirectUri,
        scopes: [...OAUTH_SCOPES],
        usePKCE: true,
        // Legacy browser path: `lang` + `intent` for Rovas HybridAuth.
        extraParams: { lang: getLocale(), intent },
      });
      await request.getAuthRequestConfigAsync();

      if (Platform.OS === "android") {
        return signInOnAndroid(request, discovery);
      }
      return signInWithPrompt(request, discovery);
    },
    [signInOnAndroid, signInWithPrompt],
  );

  const signOut = useCallback(async () => {
    const discovery = getRovasDiscovery();
    const access = tokensRef.current?.accessToken;
    const refresh = tokensRef.current?.refreshToken;
    await clearSession();
    void (async () => {
      try {
        if (access) {
          await revokeAsync(
            {
              clientId: getOAuthClientId(),
              token: access,
              tokenTypeHint: TokenTypeHint.AccessToken,
            },
            discovery,
          );
        }
        if (refresh) {
          await revokeAsync(
            {
              clientId: getOAuthClientId(),
              token: refresh,
              tokenTypeHint: TokenTypeHint.RefreshToken,
            },
            discovery,
          );
        }
      } catch {
        // Revocation best-effort — local session already cleared.
      }
    })();
  }, [clearSession]);

  useEffect(() => {
    setAccessTokenGetter(getAccessToken);
    setUnauthorizedHandler(() => refreshAccessToken(true));
    return () => {
      setAccessTokenGetter(null);
      setUnauthorizedHandler(null);
    };
  }, [getAccessToken, refreshAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken: tokens?.accessToken ?? null,
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
      signIn,
      signOut,
      getAccessToken,
    }),
    [
      beginFacebookSignIn,
      beginOpenStreetMapSignIn,
      clearFacebookPending,
      clearOsmPending,
      completeFacebookSignIn,
      completeOpenStreetMapSignIn,
      facebookPending,
      getAccessToken,
      osmPending,
      registerWithPassword,
      signIn,
      signInWithApple,
      signInWithGoogle,
      signInWithNabezky,
      signInWithPassword,
      signOut,
      status,
      tokens?.accessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
