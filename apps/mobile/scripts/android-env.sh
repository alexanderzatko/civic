#!/usr/bin/env bash
# Shared Android SDK setup for Civic mobile scripts.

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "${HOME}/Library/Android/sdk" ]]; then
    export ANDROID_HOME="${HOME}/Library/Android/sdk"
  else
    echo "ANDROID_HOME is not set and ~/Library/Android/sdk was not found." >&2
    exit 1
  fi
fi

export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator:${PATH}"

if [[ -d android ]]; then
  printf 'sdk.dir=%s\n' "${ANDROID_HOME}" > android/local.properties
fi
