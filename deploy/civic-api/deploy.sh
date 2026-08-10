#!/usr/bin/env bash
# Deploy Civic API to sano-vps (/opt/docker/civic-api) and enable civic-api.rovas.app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-sano-vps}"
REMOTE_DIR="${REMOTE_DIR:-/opt/docker/civic-api}"
PROXY_CONF_DIR="${PROXY_CONF_DIR:-/opt/docker/nginx-proxy/conf.d}"
DOMAIN="civic-api.rovas.app"

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

echo "==> Building and starting civic-api container"
ssh "$REMOTE_HOST" "bash -s" <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
docker compose build
docker compose up -d
docker compose ps
EOF

echo "==> Health check"
sleep 2
curl -fsS "https://${DOMAIN}/health" | head -c 500
echo
echo "Deploy complete: https://${DOMAIN}"
