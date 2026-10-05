#!/usr/bin/env bash
# Upload an Android APK to Firebase App Distribution.
#
# Required env:
#   FIREBASE_APP_ID                 — Android App ID (1:…:android:…)
#   GOOGLE_APPLICATION_CREDENTIALS  — path to service-account JSON
#
# Optional env:
#   FIREBASE_TESTER_GROUPS          — comma-separated groups (default: civic-testers)
#
# Usage:
#   ./scripts/distribute-android-firebase.sh [path/to/app.apk] [release notes…]
#
# If no APK path is given, uses the latest local release APK under dist/.

set -euo pipefail

cd "$(dirname "$0")/.."

GROUPS="${FIREBASE_TESTER_GROUPS:-civic-testers}"

if [[ -z "${FIREBASE_APP_ID:-}" ]]; then
  echo "FIREBASE_APP_ID is required (Firebase Project settings → Your apps → App ID)." >&2
  exit 1
fi

if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  echo "GOOGLE_APPLICATION_CREDENTIALS is required (path to Firebase service-account JSON)." >&2
  exit 1
fi

if [[ ! -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  echo "Service account file not found: ${GOOGLE_APPLICATION_CREDENTIALS}" >&2
  exit 1
fi

APK_PATH=""
RELEASE_NOTES=""

if [[ $# -ge 1 && -f "$1" ]]; then
  APK_PATH="$1"
  shift
  RELEASE_NOTES="${*:-}"
elif [[ $# -ge 1 && "$1" == *.apk ]]; then
  echo "APK not found: $1" >&2
  exit 1
else
  RELEASE_NOTES="${*:-}"
fi

if [[ -z "$APK_PATH" ]]; then
  if [[ -d dist ]]; then
    APK_PATH="$(ls -t dist/civic-*-android-release.apk 2>/dev/null | head -1 || true)"
  fi
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "No APK found. Pass a path, or build one first:" >&2
  echo "  pnpm --filter @civic/mobile android:apk" >&2
  echo "  # or download an EAS preview build, then:" >&2
  echo "  pnpm --filter @civic/mobile android:distribute:firebase path/to.apk" >&2
  exit 1
fi

if [[ -z "$RELEASE_NOTES" ]]; then
  VERSION="$(node -p "require('./package.json').version")"
  RELEASE_NOTES="Civic ${VERSION} ($(basename "$APK_PATH"))"
fi

echo "Uploading ${APK_PATH}"
echo "  app:    ${FIREBASE_APP_ID}"
echo "  groups: ${GROUPS}"
echo "  notes:  ${RELEASE_NOTES}"

npx --yes firebase-tools@latest appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --groups "$GROUPS" \
  --release-notes "$RELEASE_NOTES"

echo "Done. Testers in group(s) '${GROUPS}' will get an email invite / update."
