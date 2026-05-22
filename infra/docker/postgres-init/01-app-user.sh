#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Postgres bootstrap — runs ONCE on first container init.
#
# Creates a non-superuser role `app_user` that the API connects as at runtime.
# Because `app_user` lacks BYPASSRLS, the row-level security policies defined
# in the initial migration are actually enforced — defense in depth above the
# service-layer tenant filtering.
#
# DEFAULT PRIVILEGES are scoped to objects created by the migration-running
# superuser (`POSTGRES_USER`), so any tables Prisma adds in future migrations
# automatically grant CRUD to app_user without us having to remember a follow-up
# GRANT statement.
#
# This file is mounted into /docker-entrypoint-initdb.d/ — re-running requires
# nuking the postgres_data volume (`docker compose down -v`).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${APP_USER_PASSWORD:?APP_USER_PASSWORD must be set in the postgres service env}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- App role used by the API for runtime queries (not migrations).
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_USER_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO app_user;
  GRANT USAGE ON SCHEMA public TO app_user;

  -- Existing tables (none on first init, but covers re-runs after manual nuke).
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

  -- Future tables (those Prisma will create on migration) inherit privileges.
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;

  -- pgvector requires schema access; vector tables in Phase 6 will use it.
  ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO app_user;
EOSQL

echo "[postgres-init] app_user role + default privileges configured."
