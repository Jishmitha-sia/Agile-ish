# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Agile-ish API — multi-stage build.
#
# Stages:
#   pruner  → `turbo prune` produces a minimal monorepo subset for @agile-ish/api
#             so subsequent layers don't invalidate when unrelated apps change.
#   deps    → install dependencies, cached against pnpm-lock.yaml.
#   build   → generate Prisma client + compile TypeScript.
#   runner  → minimal runtime image, non-root, tini for signal handling.
#
# The final image runs `node dist/main.js` as a non-root user with no build
# toolchain on disk. Prisma engine binaries are copied in alongside the
# generated client.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22.13.0

# ───── Base ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ───── Pruner ────────────────────────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.3 prune @agile-ish/api --docker

# ───── Deps (install only what the pruned subset needs) ──────────────────────
FROM base AS deps
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/.npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-frozen-lockfile

# ───── Build (typecheck, prisma generate, nest build) ────────────────────────
FROM base AS build
COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./
# Generate the Prisma client (writes to apps/api/src/generated/prisma).
RUN pnpm --filter @agile-ish/api db:generate
# Build the contracts package first so api can resolve its types.
RUN pnpm --filter @agile-ish/contracts build
RUN pnpm --filter @agile-ish/api build
# Prune dev deps for the production install.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @agile-ish/api --prod deploy /app/deploy/api

# ───── Runner ────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps"
WORKDIR /app

# tini gives us proper SIGTERM handling; openssl is needed by the Prisma engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nestjs

COPY --from=build --chown=nestjs:nodejs /app/deploy/api ./
# The deploy command above already includes apps/api/dist + node_modules.
# Prisma migrations + schema travel with the image so `prisma migrate deploy`
# can run as an init job in production.
COPY --from=build --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

USER nestjs
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
