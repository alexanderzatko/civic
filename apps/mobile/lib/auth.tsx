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
import {
  registerCivicPushToken,
  unregisterCivicPushToken,
} from "@/lib/push-notifications";
import {
  clearPendingVerificationsState,
  refreshPendingVerifications,
} from "@/lib/pending-verifications";

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  accessToken: string | null;
  /** Start Rovas Authorization Code + PKCE in the system browser. */
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Fresh access token (refreshes when needed). */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const OAUTH_REDIRECT_TIMEOUT_MS = 120_000;

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

function waitForOAuthRedirect(redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      sub.remove();
      handler();
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error("OAuth redirect timed out")));
    }, OAUTH_REDIRECT_TIMEOUT_MS);

    const handler = ({ url }: { url: string }) => {
      if (url.startsWith(redirectUri)) {
        finish(() => resolve(url));
      }
    };

    const sub = Linking.addEventListener("url", handler);

    void Linking.getInitialURL().then((url) => {
      if (url?.startsWith(redirectUri)) {
        finish(() => resolve(url));
      }
    });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const tokensRef = useRef<StoredTokens | null>(null);
  tokensRef.current = tokens;
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  const oauthResumeInFlightRef = useRef(false);

  const clearSession = useCallback(async () => {
    void unregisterCivicPushToken().catch(() => undefined);
    clearPendingVerificationsState();
    await clearPendingOAuth();
    await clearTokens();
    setTokens(null);
    setStatus("signedOut");
  }, []);

  const persist = useCallback(async (next: StoredTokens | null) => {
    if (next?.accessToken) {
      await saveTokens(next);
      setTokens(next);
      setStatus("signedIn");
      void registerCivicPushToken();
      void refreshPendingVerifications();
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
        return true;
      } finally {
        await clearPendingOAuth();
      }
    },
    [persist],
  );

  const signIn = useCallback(async (): Promise<boolean> => {
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
    });
    await request.getAuthRequestConfigAsync();

    if (Platform.OS === "android") {
      return signInOnAndroid(request, discovery);
    }
    return signInWithPrompt(request, discovery);
  }, [signInOnAndroid, signInWithPrompt]);

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
      signIn,
      signOut,
      getAccessToken,
    }),
    [getAccessToken, signIn, signOut, status, tokens?.accessToken],
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
