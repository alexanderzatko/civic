#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "${HOME}/Library/Android/sdk" ]]; then
    export ANDROID_HOME="${HOME}/Library/Android/sdk"
  else
    echo "ANDROID_HOME is not set and ~/Library/Android/sdk was not found." >&2
    exit 1
  fi
fi

export PATH="${ANDROID_HOME}/platform-tools:${PATH}"

VERSION="$(node -p "require('./package.json').version")"
OUT_DIR="dist"
OUT_APK="${OUT_DIR}/civic-${VERSION}-android-release.apk"

if [[ ! -d android ]]; then
  echo "Generating android/ via expo prebuild…"
  npx expo prebuild --platform android --no-install
fi

echo "Building release APK (first run can take 30–40 minutes)…"
# Use Gradle directly — expo run:android always installs on a connected device/emulator
# after the build; --no-install only skips npm dependency installation.
(
  cd android
  ./gradlew assembleRelease
)

mkdir -p "${OUT_DIR}"
cp android/app/build/outputs/apk/release/app-release.apk "${OUT_APK}"
echo ""
echo "APK ready: ${OUT_APK}"
ls -lh "${OUT_APK}"
