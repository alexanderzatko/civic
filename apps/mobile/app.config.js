/**
 * Dynamic Expo config so Google Sign-In `iosUrlScheme` and Facebook Login
 * `fb{APP_ID}` native URL handling come from env at prebuild time.
 *
 * Loads `apps/mobile/.env` explicitly so prebuild/Xcode runs see the same
 * values as Metro (Expo does this for `expo start`, but not always for every
 * config evaluation path).
 *
 * Facebook redirect is Meta’s `fb{APP_ID}://authorize`. Keep `expo.scheme` as
 * `civic` only (avoids expo-linking multi-scheme warnings). Register `fb…` at
 * the end of the plugins list so it survives Expo’s own URL-type generation.
 */
const fs = require("fs");
const path = require("path");
const { withInfoPlist } = require("@expo/config-plugins");

const appJson = require("./app.json");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Do not override a value already exported in the shell.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(__dirname, ".env"));

function googleIosUrlScheme() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  // 123-abc.apps.googleusercontent.com → com.googleusercontent.apps.123-abc
  const m = /^([^.]+)\.apps\.googleusercontent\.com$/.exec(clientId);
  if (m) return `com.googleusercontent.apps.${m[1]}`;
  const explicit = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (explicit) return explicit;
  // Prebuild still needs a scheme string; replace before shipping a device build.
  return "com.googleusercontent.apps.CONFIGURE_GOOGLE_IOS_CLIENT";
}

/** Meta Valid OAuth Redirect URI is `fb{APP_ID}://authorize`. */
function facebookUrlScheme() {
  const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() ?? "";
  return appId ? `fb${appId}` : null;
}

/** Append Facebook URL scheme after Expo / Google have written CFBundleURLTypes. */
function withFacebookIosUrlScheme(scheme) {
  return (config) => {
    if (!scheme) return config;
    return withInfoPlist(config, (cfg) => {
      const existing = cfg.modResults.CFBundleURLTypes ?? [];
      const already = existing.some(
        (entry) =>
          Array.isArray(entry.CFBundleURLSchemes) &&
          entry.CFBundleURLSchemes.includes(scheme),
      );
      if (!already) {
        cfg.modResults.CFBundleURLTypes = [
          ...existing,
          {
            CFBundleURLName: "facebook-login",
            CFBundleURLSchemes: [scheme],
          },
        ];
      }
      return cfg;
    });
  };
}

const expo = appJson.expo;
const iosUrlScheme = googleIosUrlScheme();
const fbScheme = facebookUrlScheme();

const androidIntentFilters = [...(expo.android?.intentFilters ?? [])];
if (fbScheme) {
  androidIntentFilters.push({
    action: "VIEW",
    autoVerify: false,
    data: [
      {
        scheme: fbScheme,
        host: "authorize",
      },
    ],
    category: ["BROWSABLE", "DEFAULT"],
  });
}

module.exports = {
  expo: {
    ...expo,
    scheme: "civic",
    ios: {
      ...expo.ios,
      usesAppleSignIn: true,
    },
    android: {
      ...expo.android,
      intentFilters: androidIntentFilters,
    },
    plugins: [
      ...(expo.plugins ?? []),
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme,
        },
      ],
      // Last: must run after Google / scheme plugins rewrite URL types.
      withFacebookIosUrlScheme(fbScheme),
    ],
  },
};
