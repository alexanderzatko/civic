#!/usr/bin/env bash
# Deploy Civic API to sano-vps (/opt/docker/civic-api) and enable civic-api.rovas.app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-sano-vps}"
REMOTE_DIR="${REMOTE_DIR:-/opt/docker/civic-api}"
PROXY_CONF_DIR="${PROXY_CONF_DIR:-/opt/docker/nginx-proxy/conf.d}"
DOMAIN="civic-api.rovas.app"

# --- added: memory safety knobs ---
# sano-vps is a 4GB, no-swap VPS shared by native MariaDB/PHP-FPM/Apache/Node
# plus all docker containers. `docker compose build` (pnpm/tsc) is the single
# biggest memory spike in this script, and it lands right before `up -d`
# recreates the container — that combination has triggered whole-VPS OOM
# kills of unrelated services (mariadbd, php-fpm) in the past.
MIN_AVAILABLE_MB="${MIN_AVAILABLE_MB:-1000}"
MEM_CHECK_RETRIES="${MEM_CHECK_RETRIES:-5}"
MEM_CHECK_WAIT_SECS="${MEM_CHECK_WAIT_SECS:-30}"
BUILD_NODE_MAX_OLD_SPACE_MB="${BUILD_NODE_MAX_OLD_SPACE_MB:-768}"

wait_for_available_memory() {
  local attempt=1
  local available_mb
  while (( attempt <= MEM_CHECK_RETRIES )); do
    available_mb="$(ssh "$REMOTE_HOST" "free -m | awk '/^Mem:/{print \$7}'")"
    if (( available_mb >= MIN_AVAILABLE_MB )); then
      echo "==> ${REMOTE_HOST} has ${available_mb}MB available (>= ${MIN_AVAILABLE_MB}MB) — proceeding"
      return 0
    fi
    echo "==> ${REMOTE_HOST} only has ${available_mb}MB available (< ${MIN_AVAILABLE_MB}MB)." \
         "Attempt ${attempt}/${MEM_CHECK_RETRIES}, waiting ${MEM_CHECK_WAIT_SECS}s..."
    sleep "$MEM_CHECK_WAIT_SECS"
    ((attempt++))
  done
  echo "!! Aborting deploy: ${REMOTE_HOST} did not free up enough memory" \
       "(< ${MIN_AVAILABLE_MB}MB available) after ${MEM_CHECK_RETRIES} attempts." >&2
  echo "!! Check for a running vips/tiffcp image-processing job or another deploy in progress, then retry." >&2
  exit 1
}
# --- end added ---

echo "==> Syncing build context to ${REMOTE_HOST}:${REMOTE_DIR}"

ssh "$REMOTE_HOST" "mkdir -p '${REMOTE_DIR}/data' '${REMOTE_DIR}/packages/shared' '${REMOTE_DIR}/services/api' '${REMOTE_DIR}/apps/mobile' '${REMOTE_DIR}/nginx'"

# Deploy packaging (Dockerfile, compose, nginx templates, env example)
rsync -az --delete \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'packages/' \
  --exclude 'services/' \
  --exclude 'apps/' \
  "${ROOT}/deploy/civic-api/" "${REMOTE_HOST}:${REMOTE_DIR}/"

# Monorepo slices needed for the Docker build
rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'data/' \
  --exclude '*.tsbuildinfo' \
  "${ROOT}/packages/shared/" "${REMOTE_HOST}:${REMOTE_DIR}/packages/shared/"

rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'data/' \
  --exclude '*.tsbuildinfo' \
  "${ROOT}/services/api/" "${REMOTE_HOST}:${REMOTE_DIR}/services/api/"

rsync -az \
  "${ROOT}/apps/mobile/package.json" "${REMOTE_HOST}:${REMOTE_DIR}/apps/mobile/package.json"

rsync -az \
  "${ROOT}/package.json" \
  "${ROOT}/pnpm-lock.yaml" \
  "${ROOT}/pnpm-workspace.yaml" \
  "${ROOT}/tsconfig.base.json" \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

# Seed .env once (never overwrite a live remote .env)
ssh "$REMOTE_HOST" "bash -s" <<EOF
set -euo pipefail
if [[ ! -f '${REMOTE_DIR}/.env' ]]; then
  cp '${REMOTE_DIR}/.env.example' '${REMOTE_DIR}/.env'
  echo "Created ${REMOTE_DIR}/.env from .env.example"
else
  echo "Keeping existing ${REMOTE_DIR}/.env"
fi
# Container runs as node (uid 1000); host bind-mount must be writable.
mkdir -p '${REMOTE_DIR}/data'
chown -R 1000:1000 '${REMOTE_DIR}/data'
EOF

echo "==> Ensuring TLS cert for ${DOMAIN}"
ssh "$REMOTE_HOST" "bash -s" <<EOF
set -euo pipefail
DOMAIN='${DOMAIN}'
PROXY_CONF_DIR='${PROXY_CONF_DIR}'
REMOTE_DIR='${REMOTE_DIR}'

if [[ ! -f "/etc/letsencrypt/live/\${DOMAIN}/fullchain.pem" ]]; then
  echo "Issuing Let's Encrypt cert (bootstrap HTTP config)..."
  cp "\${REMOTE_DIR}/nginx/\${DOMAIN}.bootstrap.conf" "\${PROXY_CONF_DIR}/\${DOMAIN}.conf"
  docker exec nginx-proxy nginx -t
  docker exec nginx-proxy nginx -s reload
  certbot certonly --webroot -w /var/www/html -d "\${DOMAIN}" --non-interactive --agree-tos \
    --register-unsafely-without-email || \
  certbot certonly --webroot -w /var/www/html -d "\${DOMAIN}" --non-interactive --agree-tos \
    --email admin@rovas.app --keep-until-expiring
fi

cp "\${REMOTE_DIR}/nginx/\${DOMAIN}.conf" "\${PROXY_CONF_DIR}/\${DOMAIN}.conf"
docker exec nginx-proxy nginx -t
docker exec nginx-proxy nginx -s reload
echo "nginx-proxy reloaded for \${DOMAIN}"
EOF

# --- added: check memory before the heavy build/up step ---
echo "==> Checking available memory on ${REMOTE_HOST} before build"
wait_for_available_memory
# --- end added ---

echo "==> Building and starting civic-api container"
ssh "$REMOTE_HOST" "bash -s" <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
# NODE_OPTIONS caps the TS/pnpm build's heap so a single build step can't
# balloon and starve everything else on the box. Requires the Dockerfile to
# declare "ARG NODE_OPTIONS" and pass it through the build stage — add that
# if it isn't there yet, otherwise this build-arg is simply ignored.
docker compose build --build-arg NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_MAX_OLD_SPACE_MB}"
docker compose up -d
docker compose ps
# Clean up dangling layers left from this build so overlayfs/page-cache
# pressure doesn't accumulate deploy over deploy.
docker image prune -f --filter "dangling=true" >/dev/null
EOF

echo "==> Health check"
sleep 2
curl -fsS "https://${DOMAIN}/health" | head -c 500
echo
echo "Deploy complete: https://${DOMAIN}"