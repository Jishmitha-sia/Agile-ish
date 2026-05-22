# Agile-ish

Open-source, AI-native Scrum collaboration platform. Modular monolith built for self-hosting first and horizontal scale second.

## Architecture at a glance

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui + TanStack Query + Zustand.
- **Backend:** NestJS modular monolith with bounded-context modules, in-process event bus backed by Redis pub/sub for cross-instance fan-out.
- **Data:** PostgreSQL (with `pgvector` + RLS) via Prisma, Redis for queues/cache/rate-limiting/pub-sub.
- **Realtime:** Socket.IO (rooms, presence, notifications) + Yjs/Hocuspocus (CRDT docs, Phase 4+).
- **AI:** Provider-agnostic via LangChain.js — Ollama by default, any OpenAI-compatible endpoint via env.
- **Observability:** OpenTelemetry → Grafana stack (Tempo/Loki/Prometheus). Structured logs via pino.
- **Auth:** Argon2id + asymmetric (RS256) JWT access tokens + httpOnly rotating refresh-token cookie with reuse detection. OIDC-shaped abstraction so Keycloak/Auth0 can replace it later.

## Monorepo layout

```
agile-ish/
├── apps/
│   ├── api/                    # NestJS modular monolith
│   └── web/                    # Next.js 15 (App Router)
├── packages/
│   ├── contracts/              # Zod schemas + inferred TS types (single source of truth)
│   ├── ui/                     # Shared shadcn-based UI primitives
│   ├── config-tsconfig/        # Shared tsconfig presets
│   └── config-eslint/          # Shared ESLint presets
├── infra/
│   ├── docker/                 # docker-compose + Dockerfiles
│   └── k8s/                    # Helm charts (Phase 7)
└── .github/workflows/          # CI/CD
```

## Prerequisites

- Node.js **20.11+** (`.nvmrc` provided)
- pnpm **9+** (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker + Docker Compose

## Quick start

```powershell
# 1. Configure env (one-time)
Copy-Item .env.example .env
# Generate JWT keypair — see docs/PHASE_1_VERIFY.md for the exact commands

# 2. Install + start infrastructure
pnpm install
pnpm docker:up                  # Postgres + Redis + MailHog
pnpm db:migrate                 # apply schema + RLS policies
pnpm db:seed                    # optional: demo@agile-ish.local / AgileIshDemo!2026

# 3. Run both apps with hot reload
pnpm dev
```

| Surface | URL |
| --- | --- |
| Web | <http://localhost:3000> |
| API | <http://localhost:4000> |
| OpenAPI docs | <http://localhost:4000/docs> |
| MailHog (captured emails) | <http://localhost:8025> |
| Adminer (DB GUI, optional) | <http://localhost:8080> — start with `--profile tools` |

**Full Phase 1 verification recipe:** see [docs/PHASE_1_VERIFY.md](docs/PHASE_1_VERIFY.md) for the end-to-end smoke test (signup, RLS check, audit log query, refresh-token rotation).

## Phase plan

1. **Foundation** — monorepo, auth, workspaces (current).
2. **Workspaces & projects** — full CRUD, RBAC.
3. **Scrum boards & issues** — drag-and-drop, sprints, optimistic UI.
4. **Realtime collab** — Socket.IO presence, Yjs/Hocuspocus docs.
5. **Analytics** — burndown, velocity, cycle time.
6. **AI features** — sprint summaries, issue generation, semantic search.
7. **Deployment & scaling** — Helm, multi-region, pgbouncer, HPA.

## Engineering rules

- Strict TypeScript everywhere (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- All env vars validated at boot via Zod — the API refuses to start on misconfigured env.
- All DTOs are Zod schemas from `@agile-ish/contracts` — no class-validator drift.
- Every module emits domain events. Every write produces an audit log entry.
- Multi-tenancy enforced at the service layer (Prisma client extension injecting `workspaceId`) **and** at the database layer (Postgres RLS).

## License

AGPL-3.0-or-later.
