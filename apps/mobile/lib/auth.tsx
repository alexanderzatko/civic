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
import { AppState } from "react-native";
import {
  AuthRequest,
  TokenResponse,
  TokenTypeHint,
  exchangeCodeAsync,
  revokeAsync,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  clearTokens,
  loadTokens,
  saveTokens,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const tokensRef = useRef<StoredTokens | null>(null);
  tokensRef.current = tokens;
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

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
      } else {
        setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const clearSession = useCallback(async () => {
    void unregisterCivicPushToken().catch(() => undefined);
    clearPendingVerificationsState();
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

  const signIn = useCallback(async (): Promise<boolean> => {
    await WebBrowser.dismissBrowser().catch(() => undefined);
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
    if (!request.codeVerifier) {
      throw new Error("PKCE code_verifier missing from auth request");
    }

    let token: TokenResponse;
    try {
      token = await exchangeCodeAsync(
        {
          clientId: getOAuthClientId(),
          code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier,
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
    await persist(toStored(token));
    return true;
  }, [persist]);

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
