/**
 * Dynamic Expo config so Google Sign-In `iosUrlScheme` can come from env
 * (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`) at prebuild time.
 */
const appJson = require("./app.json");

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
          iosUrlScheme: googleIosUrlScheme(),
        },
      ],
    ],
  },
};
