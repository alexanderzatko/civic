import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AuthRequest,
  TokenResponse,
  TokenTypeHint,
  exchangeCodeAsync,
  refreshAsync,
  revokeAsync,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  clearTokens,
  loadTokens,
  saveTokens,
  type StoredTokens,
} from "@/lib/auth-storage";
import { setAccessTokenGetter } from "@/lib/api";
import {
  getOAuthClientId,
  getOAuthRedirectUri,
  getRovasDiscovery,
  OAUTH_SCOPES,
} from "@/lib/oauth";

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

function toStored(token: TokenResponse): StoredTokens {
  return token.getRequestConfig();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadTokens();
      if (cancelled) return;
      if (stored?.accessToken) {
        setTokens(stored);
        setStatus("signedIn");
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

  const persist = useCallback(async (next: StoredTokens | null) => {
    if (next?.accessToken) {
      await saveTokens(next);
      setTokens(next);
      setStatus("signedIn");
    } else {
      await clearTokens();
      setTokens(null);
      setStatus("signedOut");
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!tokens?.accessToken) return null;
    const current = new TokenResponse(tokens);
    if (!current.shouldRefresh()) {
      return current.accessToken;
    }
    if (!tokens.refreshToken) {
      await persist(null);
      return null;
    }
    try {
      const refreshed = await refreshAsync(
        {
          clientId: getOAuthClientId(),
          refreshToken: tokens.refreshToken,
        },
        getRovasDiscovery(),
      );
      const stored = toStored(refreshed);
      await persist(stored);
      return refreshed.accessToken;
    } catch {
      await persist(null);
      return null;
    }
  }, [persist, tokens]);

  const signIn = useCallback(async (): Promise<boolean> => {
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

    const token = await exchangeCodeAsync(
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
    await persist(toStored(token));
    return true;
  }, [persist]);

  const signOut = useCallback(async () => {
    const discovery = getRovasDiscovery();
    const access = tokens?.accessToken;
    const refresh = tokens?.refreshToken;
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
      // Revocation best-effort — still clear local session.
    }
    await persist(null);
  }, [persist, tokens]);

  useEffect(() => {
    setAccessTokenGetter(getAccessToken);
    return () => setAccessTokenGetter(null);
  }, [getAccessToken]);

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
