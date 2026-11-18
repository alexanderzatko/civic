#!/usr/bin/env bash
# Deploy Civic API to sano-vps (/opt/docker/civic-api) and enable civic-api.rovas.app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-sano-vps}"
REMOTE_DIR="${REMOTE_DIR:-/opt/docker/civic-api}"
PROXY_CONF_DIR="${PROXY_CONF_DIR:-/opt/docker/nginx-proxy/conf.d}"
DOMAIN="civic-api.rovas.app"

# Sibling stacks stopped for the duration of the Civic API build so the 4GB
# VPS has headroom. Restarted on success or failure (EXIT trap).
PAUSE_STACK_DIRS=(
  /opt/docker/lepidoptera
  /opt/docker/zajezka
  /opt/docker/copyfast-print
)

# sano-vps is a 4GB, no-swap VPS shared by native MariaDB/PHP-FPM/Apache/Node
# plus all docker containers. `docker compose build` (pnpm/tsc) is the single
# biggest memory spike in this script, and it lands right before `up -d`
# recreates the container — that combination has triggered whole-VPS OOM
# kills of unrelated services (mariadbd, php-fpm) in the past.
MIN_AVAILABLE_MB="${MIN_AVAILABLE_MB:-1000}"
MEM_CHECK_RETRIES="${MEM_CHECK_RETRIES:-5}"
MEM_CHECK_WAIT_SECS="${MEM_CHECK_WAIT_SECS:-30}"
BUILD_NODE_MAX_OLD_SPACE_MB="${BUILD_NODE_MAX_OLD_SPACE_MB:-768}"

STACKS_PAUSED=0

# Avoid stuck ControlMaster sockets stalling the whole deploy.
SSH_OPTS=(
  -o ConnectTimeout=30
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
  -o ControlMaster=no
  -o ControlPath=none
)

remote() {
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "$@"
}

stop_sibling_stacks() {
  echo "==> Stopping sibling stacks to free memory (lepidoptera, zajezka, copyfast-print)"
  remote "bash -s" <<EOF
set -euo pipefail
for dir in ${PAUSE_STACK_DIRS[*]}; do
  if [[ -f "\${dir}/docker-compose.yml" || -f "\${dir}/compose.yml" ]]; then
    echo "  stopping \${dir}"
    (cd "\${dir}" && docker compose stop)
  else
    echo "  skip \${dir} (no compose file)"
  fi
done
echo "  memory after stop:"
free -m | awk '/^Mem:/{printf "  Mem: total=%s used=%s available=%s\\n", \$2, \$3, \$7}'
EOF
  STACKS_PAUSED=1
}

start_sibling_stacks() {
  if [[ "$STACKS_PAUSED" -ne 1 ]]; then
    return 0
  fi
  echo "==> Restarting sibling stacks"
  # Best-effort: do not fail the deploy health summary if a site is slow to start.
  remote "bash -s" <<EOF || true
set -u
for dir in ${PAUSE_STACK_DIRS[*]}; do
  if [[ -f "\${dir}/docker-compose.yml" || -f "\${dir}/compose.yml" ]]; then
    echo "  starting \${dir}"
    (cd "\${dir}" && docker compose start) || echo "  !! failed to start \${dir}"
  fi
done
docker ps --format 'table {{.Names}}\t{{.Status}}' | head -20
EOF
  STACKS_PAUSED=0
}

on_exit() {
  # Preserve the deploy exit status; do not `exit` from the trap.
  set +e
  start_sibling_stacks
}
trap on_exit EXIT

wait_for_available_memory() {
  local attempt=1
  local available_mb
  while (( attempt <= MEM_CHECK_RETRIES )); do
    available_mb="$(remote "free -m | awk '/^Mem:/{print \$7}'")"
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
  echo "!! Sibling stacks were already stopped; check for a running vips/tiffcp" \
       "image-processing job or another deploy in progress, then retry." >&2
  exit 1
}

ensure_tls_and_reload_nginx() {
  # Must run while sibling upstreams (zajezka-web, …) are up — nginx -t
  # loads every conf.d/*.conf and fails if those hostnames are missing.
  echo "==> Ensuring TLS cert for ${DOMAIN}"
  remote "bash -s" <<EOF
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
}

# --- free RAM before any heavy sync/build work ---
stop_sibling_stacks

echo "==> Checking available memory on ${REMOTE_HOST} before sync/build"
wait_for_available_memory

echo "==> Syncing build context to ${REMOTE_HOST}:${REMOTE_DIR}"

remote "mkdir -p '${REMOTE_DIR}/data' '${REMOTE_DIR}/packages/shared' '${REMOTE_DIR}/services/api' '${REMOTE_DIR}/apps/mobile' '${REMOTE_DIR}/nginx'"

# Deploy packaging (Dockerfile, compose, nginx templates, env example)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

rsync -az --delete -e "$RSYNC_SSH" \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'packages/' \
  --exclude 'services/' \
  --exclude 'apps/' \
  "${ROOT}/deploy/civic-api/" "${REMOTE_HOST}:${REMOTE_DIR}/"

# Monorepo slices needed for the Docker build
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'data/' \
  --exclude '*.tsbuildinfo' \
  "${ROOT}/packages/shared/" "${REMOTE_HOST}:${REMOTE_DIR}/packages/shared/"

rsync -az --delete -e "$RSYNC_SSH" \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'data/' \
  --exclude '*.tsbuildinfo' \
  "${ROOT}/services/api/" "${REMOTE_HOST}:${REMOTE_DIR}/services/api/"

rsync -az -e "$RSYNC_SSH" \
  "${ROOT}/apps/mobile/package.json" "${REMOTE_HOST}:${REMOTE_DIR}/apps/mobile/package.json"

rsync -az -e "$RSYNC_SSH" \
  "${ROOT}/package.json" \
  "${ROOT}/pnpm-lock.yaml" \
  "${ROOT}/pnpm-workspace.yaml" \
  "${ROOT}/tsconfig.base.json" \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

# Seed .env once (never overwrite a live remote .env)
remote "bash -s" <<EOF
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

# Install civic-api nginx conf on disk only — do not nginx -t/reload while
# sibling stacks are stopped (other conf.d hosts reference those containers).
echo "==> Staging ${DOMAIN} nginx conf (reload after sibling stacks are back)"
remote "cp '${REMOTE_DIR}/nginx/${DOMAIN}.conf' '${PROXY_CONF_DIR}/${DOMAIN}.conf'"

echo "==> Re-checking available memory on ${REMOTE_HOST} before build"
wait_for_available_memory

echo "==> Building and starting civic-api container"
remote "bash -s" <<EOF
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

# Bring siblings back before nginx -t (upstream hostnames must resolve).
start_sibling_stacks
# Disable EXIT restart (already started); keep trap for unexpected later failures.
STACKS_PAUSED=0

# Wait briefly for Docker DNS to publish container names.
sleep 3
ensure_tls_and_reload_nginx

echo "==> Health check"
sleep 2
curl -fsS "https://${DOMAIN}/health" | head -c 500
echo
echo "Deploy complete: https://${DOMAIN}"
