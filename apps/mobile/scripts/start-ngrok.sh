#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${NGROK_STATIC_DOMAIN:?Set NGROK_STATIC_DOMAIN in apps/mobile/.env (see .env.example)}"

export EXPO_PACKAGER_PROXY_URL="${EXPO_PACKAGER_PROXY_URL:-https://${NGROK_STATIC_DOMAIN}}"
export EXPO_NO_METRO_WORKSPACE_ROOT=1

exec expo start --dev-client --lan
