import * as Linking from "expo-linking";
import {
  AuthRequest,
  ResponseType,
  type AuthSessionResult,
} from "expo-auth-session";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  SocialAuthCancelledError,
  SocialAuthError,
} from "@/lib/social-auth";

const OAUTH_REDIRECT_TIMEOUT_MS = 120_000;

export function waitForOAuthRedirect(redirectUri: string): Promise<string> {
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

export function parseOAuthRedirectParams(
  url: string,
  expectedState: string,
): Record<string, string> {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const state = typeof params.state === "string" ? params.state : undefined;
  const error =
    typeof params.error === "string"
      ? params.error
      : typeof params.error_description === "string"
        ? params.error_description
        : undefined;

  if (state !== expectedState) {
    throw new SocialAuthError("OAuth state mismatch");
  }
  if (error) {
    throw new SocialAuthError(error);
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

type AuthSuccessResult = {
  type: "success";
  params: Record<string, string>;
  authentication: { accessToken?: string } | null;
};

function requireSuccessResult(result: AuthSessionResult): AuthSuccessResult {
  if (result.type === "cancel" || result.type === "dismiss") {
    throw new SocialAuthCancelledError();
  }
  if (result.type !== "success") {
    throw new SocialAuthError("Authorization failed");
  }
  return result as AuthSuccessResult;
}

export type BrowserAuthCodeResult = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

/**
 * Authorization-code + PKCE via system browser.
 * Android uses Linking (same pattern as Rovas) because Custom Tabs often
 * resolve promptAsync as "dismiss" when the app handles the deep link.
 */
export async function authorizeWithBrowserCode(options: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  extraParams?: Record<string, string>;
}): Promise<BrowserAuthCodeResult> {
  const request = new AuthRequest({
    clientId: options.clientId,
    redirectUri: options.redirectUri,
    scopes: options.scopes,
    responseType: ResponseType.Code,
    usePKCE: true,
    extraParams: options.extraParams,
  });
  await request.getAuthRequestConfigAsync();

  if (!request.codeVerifier) {
    throw new SocialAuthError("PKCE code_verifier missing from auth request");
  }

  const discovery = {
    authorizationEndpoint: options.authorizationEndpoint,
  };

  if (Platform.OS === "android") {
    const authUrl = await request.makeAuthUrlAsync(discovery);
    const redirectPromise = waitForOAuthRedirect(options.redirectUri);
    await WebBrowser.openBrowserAsync(authUrl);
    const returnUrl = await redirectPromise;
    const params = parseOAuthRedirectParams(returnUrl, request.state);
    const code = params.code;
    if (!code) {
      throw new SocialAuthError("Authorization response missing code");
    }
    return {
      code,
      codeVerifier: request.codeVerifier,
      redirectUri: options.redirectUri,
    };
  }

  const result = requireSuccessResult(await request.promptAsync(discovery));
  const code = result.params.code;
  if (!code) {
    throw new SocialAuthError("Authorization response missing code");
  }
  return {
    code,
    codeVerifier: request.codeVerifier,
    redirectUri: options.redirectUri,
  };
}

/**
 * Implicit/token response via system browser (Facebook).
 */
export async function authorizeWithBrowserToken(options: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  extraParams?: Record<string, string>;
}): Promise<string> {
  const request = new AuthRequest({
    clientId: options.clientId,
    redirectUri: options.redirectUri,
    scopes: options.scopes,
    responseType: ResponseType.Token,
    usePKCE: false,
    extraParams: options.extraParams,
  });
  await request.getAuthRequestConfigAsync();

  const discovery = {
    authorizationEndpoint: options.authorizationEndpoint,
  };

  if (Platform.OS === "android") {
    const authUrl = await request.makeAuthUrlAsync(discovery);
    const redirectPromise = waitForOAuthRedirect(options.redirectUri);
    await WebBrowser.openBrowserAsync(authUrl);
    const returnUrl = await redirectPromise;
    // access_token may be in query (rare) or hash fragment
    const fromQuery = parseTokenFromUrl(returnUrl);
    if (fromQuery) return fromQuery;
    throw new SocialAuthError("Facebook did not return an access token");
  }

  const result = requireSuccessResult(await request.promptAsync(discovery));
  const accessToken =
    result.params.access_token ??
    result.authentication?.accessToken ??
    undefined;
  if (!accessToken) {
    throw new SocialAuthError("Facebook did not return an access token");
  }
  return accessToken;
}

function parseTokenFromUrl(url: string): string | null {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  let raw = "";
  if (hashIndex >= 0) {
    raw = url.slice(hashIndex + 1);
  } else if (queryIndex >= 0) {
    raw = url.slice(queryIndex + 1);
  }
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const error = params.get("error") ?? params.get("error_description");
  if (error) {
    throw new SocialAuthError(error);
  }
  return params.get("access_token");
}

/** Where IdP deep-link splash should send the user after browser return. */
let idpReturnPath: "/(auth)/login" | "/(auth)/register" = "/(auth)/login";

export function setIdpAuthReturnPath(
  path: "/(auth)/login" | "/(auth)/register",
): void {
  idpReturnPath = path;
}

export function consumeIdpAuthReturnPath(): "/(auth)/login" | "/(auth)/register" {
  const path = idpReturnPath;
  idpReturnPath = "/(auth)/login";
  return path;
}
