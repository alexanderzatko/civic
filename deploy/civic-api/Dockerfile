# syntax=docker/dockerfile:1
# Build context: this directory after deploy.sh syncs monorepo slices here.

FROM node:22-bookworm AS builder

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/
# Present so the lockfile importer resolves; sources are not needed at runtime.
COPY apps/mobile/package.json ./apps/mobile/

# Install api + workspace deps (shared).
RUN pnpm install --frozen-lockfile --filter @civic/api...

COPY packages/shared ./packages/shared
COPY services/api ./services/api

RUN pnpm --filter @civic/shared build \
  && pnpm --filter @civic/api build \
  && pnpm --filter @civic/api deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out ./

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/civic.sqlite

EXPOSE 3001

USER node
CMD ["node", "dist/index.js"]
