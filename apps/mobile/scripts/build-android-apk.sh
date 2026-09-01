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

BUILT_APK="android/app/build/outputs/apk/release/app-release.apk"

mkdir -p "${OUT_DIR}"
cp "${BUILT_APK}" "${OUT_APK}"
echo ""
echo "APK ready: ${OUT_APK}"
ls -lh "${OUT_APK}"

echo ""
echo "Installing on emulator/device…"
if npx expo run:android --variant release --binary "${BUILT_APK}" --no-bundler; then
  echo "App launched on device/emulator."
else
  echo ""
  echo "Warning: APK built successfully but install/launch failed." >&2
  echo "  Start or cold-boot an emulator in Android Studio, then retry launch:" >&2
  echo "  npx expo run:android --variant release --binary ${BUILT_APK} --no-bundler" >&2
fi
