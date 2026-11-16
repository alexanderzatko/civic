import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getApiBaseUrl } from "@/lib/api";
import { getLocale } from "@/lib/i18n";
import type { StoredTokens } from "@/lib/auth-storage";

const APPLE_EMAIL_KEY = "civic.auth.apple.email";

export class SocialAuthCancelledError extends Error {
  constructor() {
    super("SOCIAL_AUTH_CANCELLED");
    this.name = "SocialAuthCancelledError";
  }
}

export class SocialAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialAuthError";
  }
}

type AuthApiTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  issuedAt?: number;
  rovasUid?: number;
  error?: string;
};

function toStoredTokens(body: AuthApiTokenResponse): StoredTokens {
  if (!body.accessToken) {
    throw new SocialAuthError(body.error ?? "Auth response missing access token");
  }
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresIn: body.expiresIn,
    tokenType: "bearer",
    scope: body.scope,
    issuedAt: body.issuedAt ?? Math.floor(Date.now() / 1000),
  };
}

async function postAuth(
  path: "/auth/google" | "/auth/apple",
  body: Record<string, unknown>,
): Promise<StoredTokens> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      language: getLocale(),
      country: "SK",
    }),
  });
  const json = (await res.json()) as AuthApiTokenResponse;
  if (!res.ok) {
    throw new SocialAuthError(
      typeof json.error === "string" ? json.error : `Auth failed (${res.status})`,
    );
  }
  return toStoredTokens(json);
}

let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new SocialAuthError(
      "Google Sign-In is not configured (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)",
    );
  }
  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
  });
  googleConfigured = true;
}

export async function signInWithGoogleNative(): Promise<StoredTokens> {
  ensureGoogleConfigured();
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new SocialAuthCancelledError();
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      throw new SocialAuthError("Google Sign-In did not return an ID token");
    }
    return postAuth("/auth/google", { id_token: idToken });
  } catch (err) {
    if (err instanceof SocialAuthCancelledError || err instanceof SocialAuthError) {
      throw err;
    }
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SocialAuthCancelledError();
    }
    throw new SocialAuthError(
      err instanceof Error ? err.message : "Google Sign-In failed",
    );
  }
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<StoredTokens> {
  if (Platform.OS !== "ios") {
    throw new SocialAuthError("Sign in with Apple is only available on iOS");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new SocialAuthError("Apple Sign-In did not return an identity token");
    }

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (credential.email) {
      await SecureStore.setItemAsync(APPLE_EMAIL_KEY, credential.email);
    }
    const cachedEmail =
      credential.email ?? (await SecureStore.getItemAsync(APPLE_EMAIL_KEY)) ?? undefined;

    return postAuth("/auth/apple", {
      identity_token: credential.identityToken,
      ...(fullName ? { full_name: fullName } : {}),
      ...(cachedEmail ? { email: cachedEmail } : {}),
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      throw new SocialAuthCancelledError();
    }
    if (err instanceof SocialAuthCancelledError || err instanceof SocialAuthError) {
      throw err;
    }
    throw new SocialAuthError(
      err instanceof Error ? err.message : "Apple Sign-In failed",
    );
  }
}
