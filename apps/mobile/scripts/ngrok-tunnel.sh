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

# pnpm prepends node_modules/.bin; @expo/ngrok is v2 and does not support --url.
find_system_ngrok() {
  local dir
  local -a dirs
  IFS=':' read -r -a dirs <<< "${PATH}"
  for dir in "${dirs[@]}"; do
    [[ "${dir}" == *"/node_modules/"* || "${dir}" == */node_modules ]] && continue
    if [[ -x "${dir}/ngrok" ]]; then
      printf '%s\n' "${dir}/ngrok"
      return 0
    fi
  done
  return 1
}

NGROK_BIN="$(find_system_ngrok)" || {
  echo "System ngrok CLI not found (need v3+ with --url). Install: https://ngrok.com/download" >&2
  exit 1
}

exec "${NGROK_BIN}" http --url="${NGROK_STATIC_DOMAIN}" 8081
