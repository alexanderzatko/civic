import * as Application from "expo-application";

/** User-facing marketing version (app.json / package.json). */
export function getAppVersion(): string {
  return Application.nativeApplicationVersion ?? "—";
}

/** Native build number (Android versionCode / iOS CFBundleVersion). */
export function getAppBuildNumber(): string {
  return Application.nativeBuildVersion ?? "—";
}

/** Localized-friendly "Version x.y.z (build N)" parts for About / Status. */
export function getAppVersionParts(): {
  version: string;
  build: string;
} {
  return {
    version: getAppVersion(),
    build: getAppBuildNumber(),
  };
}
