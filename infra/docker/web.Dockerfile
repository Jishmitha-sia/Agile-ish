# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Agile-ish web — multi-stage Next.js standalone build.
#
# `output: 'standalone'` in next.config.mjs makes Next emit a self-contained
# bundle with its own minimal node_modules — we copy that into a small runner
# image without any pnpm / turbo / source code.
#
# NEXT_PUBLIC_* env vars are bundled at BUILD time (statically inlined), so
# they MUST be passed as docker build-args. Runtime container env can't change
# them — that's a Next.js architectural choice, not a project one.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22.13.0

# ───── Base ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ───── Pruner ────────────────────────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.1.3 prune @agile-ish/web --docker

# ───── Deps ──────────────────────────────────────────────────────────────────
FROM base AS deps
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/.npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-frozen-lockfile

# ───── Build ─────────────────────────────────────────────────────────────────
FROM base AS build
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_REFRESH_COOKIE_NAME
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_REFRESH_COOKIE_NAME=${NEXT_PUBLIC_REFRESH_COOKIE_NAME}

COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @agile-ish/contracts build
RUN pnpm --filter @agile-ish/web build

# ───── Runner (Next.js standalone) ───────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# The standalone build emits its own server.js + minimal node_modules under
# .next/standalone. Static assets and public/ have to be copied separately.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
