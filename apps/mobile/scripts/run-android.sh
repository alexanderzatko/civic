#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source "$(dirname "$0")/android-env.sh"

exec npx expo run:android "$@"
