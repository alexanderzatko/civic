#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

RN_PATH="$(node --print "require('path').dirname(require.resolve('react-native/package.json'))")"
echo "react-native: ${RN_PATH}"

if [[ ! -f "${RN_PATH}/scripts/xcode/with-environment.sh" ]]; then
  echo "react-native Xcode scripts missing — run pnpm install from repo root first." >&2
  exit 1
fi

cd ios
pod install
