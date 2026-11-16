/**
 * Dynamic Expo config so Google Sign-In `iosUrlScheme` comes from
 * `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` at prebuild time.
 *
 * Loads `apps/mobile/.env` explicitly so prebuild/Xcode runs see the same
 * values as Metro (Expo does this for `expo start`, but not always for every
 * config evaluation path).
 */
const fs = require("fs");
const path = require("path");

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

const expo = appJson.expo;
const iosUrlScheme = googleIosUrlScheme();

module.exports = {
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      usesAppleSignIn: true,
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
    ],
  },
};
