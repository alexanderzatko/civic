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

exec ngrok http --url="${NGROK_STATIC_DOMAIN}" 8081
