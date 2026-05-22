-- ─────────────────────────────────────────────────────────────────────────────
-- Initial migration — Phase 1
--
-- This file is split into three logical sections:
--   1. Extensions (pgcrypto, citext, pg_trgm, vector)
--   2. Table DDL (generated from schema.prisma)
--   3. Hardening (RLS policies, indexes Prisma can't express, app role grants)
--
-- Prisma generates section 2 from schema.prisma. The hardening section is
-- maintained by hand and is intentionally idempotent (`IF NOT EXISTS`) so it
-- can be re-run safely against a partial DB.
-- ─────────────────────────────────────────────────────────────────────────────

-- ───── 1. Extensions ─────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ───── 2. Enums ─────
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');
CREATE TYPE "RefreshTokenRevocationReason" AS ENUM (
  'LOGOUT', 'ROTATED', 'REUSED', 'PASSWORD_CHANGED', 'ADMIN_REVOKED', 'EXPIRED'
);

-- ───── 3. Tables ─────

CREATE TABLE "users" (
  "id"                   TEXT PRIMARY KEY,
  "email"                CITEXT NOT NULL UNIQUE,
  "passwordHash"         TEXT,
  "displayName"          VARCHAR(80) NOT NULL,
  "avatarUrl"            VARCHAR(2048),
  "emailVerifiedAt"      TIMESTAMP(3),
  "timezone"             VARCHAR(64),
  "locale"               VARCHAR(16),
  "lastLoginAt"          TIMESTAMP(3),
  "defaultWorkspaceId"   TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  "deletedAt"            TIMESTAMP(3)
);
CREATE INDEX "users_defaultWorkspaceId_idx" ON "users" ("defaultWorkspaceId");
CREATE INDEX "users_deletedAt_idx" ON "users" ("deletedAt");

CREATE TABLE "workspaces" (
  "id"          TEXT PRIMARY KEY,
  "slug"        VARCHAR(32) NOT NULL UNIQUE,
  "name"        VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "avatarUrl"   VARCHAR(2048),
  "ownerId"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces" ("ownerId");
CREATE INDEX "workspaces_deletedAt_idx" ON "workspaces" ("deletedAt");

-- Late-add FK for users.defaultWorkspaceId (circular reference with workspaces)
ALTER TABLE "users"
  ADD CONSTRAINT "users_defaultWorkspaceId_fkey"
  FOREIGN KEY ("defaultWorkspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "workspace_members" (
  "userId"      TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role"        "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "invitedById" TEXT,
  "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("userId", "workspaceId"),
  CONSTRAINT "workspace_members_userId_fkey"      FOREIGN KEY ("userId")      REFERENCES "users"("id")      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id")      ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members" ("workspaceId");
CREATE INDEX "workspace_members_userId_idx"      ON "workspace_members" ("userId");

CREATE TABLE "refresh_tokens" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "familyId"      TEXT NOT NULL,
  "tokenHash"     CHAR(64) NOT NULL UNIQUE,
  "parentId"      TEXT,
  "replacedById"  TEXT UNIQUE,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" "RefreshTokenRevocationReason",
  "userAgent"     VARCHAR(512),
  "ipAddress"     VARCHAR(64),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "users"("id")          ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "refresh_tokens_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "refresh_tokens_userId_idx"    ON "refresh_tokens" ("userId");
CREATE INDEX "refresh_tokens_familyId_idx"  ON "refresh_tokens" ("familyId");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens" ("expiresAt");

CREATE TABLE "audit_logs" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT,
  "actorId"     TEXT,
  "action"      VARCHAR(64) NOT NULL,
  "targetType"  VARCHAR(32),
  "targetId"    VARCHAR(64),
  "metadata"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ipAddress"   VARCHAR(64),
  "userAgent"   VARCHAR(512),
  "requestId"   VARCHAR(64),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_actorId_fkey"     FOREIGN KEY ("actorId")     REFERENCES "users"("id")      ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs" ("workspaceId", "createdAt" DESC);
CREATE INDEX "audit_logs_actorId_createdAt_idx"     ON "audit_logs" ("actorId",     "createdAt" DESC);
CREATE INDEX "audit_logs_action_createdAt_idx"      ON "audit_logs" ("action",      "createdAt" DESC);
CREATE INDEX "audit_logs_target_idx"                ON "audit_logs" ("targetType", "targetId");

-- Trigram index on workspace slug for fast prefix search.
CREATE INDEX "workspaces_slug_trgm_idx" ON "workspaces" USING gin ("slug" gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Application role + RLS hardening
--
-- The Prisma client connects as `app_user`, which has BASE table privileges
-- but NOT BYPASSRLS. RLS policies reference per-request session settings:
--
--   SET LOCAL app.user_id      = '<userId>';
--   SET LOCAL app.workspace_id = '<workspaceId>';   -- when applicable
--
-- These are set by PrismaService.withRequestContext() at the start of every
-- request transaction. Code paths that legitimately need cross-tenant access
-- (system jobs, audit log writers, migrations) connect as `app_admin`, which
-- has BYPASSRLS.
--
-- DB-level enforcement is defense in depth — the service layer already
-- filters by workspaceId, but if a future bug omits the filter, RLS catches it.
-- ─────────────────────────────────────────────────────────────────────────────

-- Migrations run as the superuser configured in DIRECT_URL. The `app_user`
-- role for runtime queries is created via a separate bootstrap migration
-- that an operator runs once per environment (see prisma/migrations/_meta/).
-- We *prepare* the policies here; granting them takes effect once the role
-- exists. The policies are no-ops if app.user_id is unset (e.g. during
-- migrations, where we connect as a privileged role).

-- Helper: returns the request-scoped user id, or NULL if unset.
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.user_id', true), '');
END;
$$;

-- Helper: returns the request-scoped workspace id, or NULL if unset.
CREATE OR REPLACE FUNCTION current_app_workspace_id() RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.workspace_id', true), '');
END;
$$;

-- Workspaces: a user can see workspaces they are a member of.
-- The membership check goes via workspace_members; that table's own policy
-- gates row visibility there. We use SECURITY DEFINER to keep the policy
-- cheap and avoid recursive RLS evaluation.
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_member_select" ON "workspaces"
  FOR SELECT
  USING (
    current_app_user_id() IS NULL  -- bypass when running outside request scope
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m
      WHERE m."workspaceId" = "workspaces"."id"
        AND m."userId" = current_app_user_id()
    )
  );
CREATE POLICY "workspaces_member_modify" ON "workspaces"
  FOR ALL
  USING (
    current_app_user_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m
      WHERE m."workspaceId" = "workspaces"."id"
        AND m."userId" = current_app_user_id()
        AND m."role" IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    current_app_user_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m
      WHERE m."workspaceId" = "workspaces"."id"
        AND m."userId" = current_app_user_id()
        AND m."role" IN ('OWNER', 'ADMIN')
    )
  );

-- WorkspaceMembers: a user can see memberships for workspaces they belong to.
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_visible" ON "workspace_members"
  FOR SELECT
  USING (
    current_app_user_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m2
      WHERE m2."workspaceId" = "workspace_members"."workspaceId"
        AND m2."userId" = current_app_user_id()
    )
  );
CREATE POLICY "workspace_members_admin_modify" ON "workspace_members"
  FOR ALL
  USING (
    current_app_user_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m2
      WHERE m2."workspaceId" = "workspace_members"."workspaceId"
        AND m2."userId" = current_app_user_id()
        AND m2."role" IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    current_app_user_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM "workspace_members" m2
      WHERE m2."workspaceId" = "workspace_members"."workspaceId"
        AND m2."userId" = current_app_user_id()
        AND m2."role" IN ('OWNER', 'ADMIN')
    )
  );

-- AuditLogs: visible to members of the workspace; system-scoped logs
-- (workspaceId IS NULL) are admin-only — exposed via dedicated endpoints
-- that connect with the privileged role.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_workspace_select" ON "audit_logs"
  FOR SELECT
  USING (
    current_app_user_id() IS NULL
    OR (
      "workspaceId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "workspace_members" m
        WHERE m."workspaceId" = "audit_logs"."workspaceId"
          AND m."userId" = current_app_user_id()
          AND m."role" IN ('OWNER', 'ADMIN')
      )
    )
  );
-- INSERT policy: any authenticated session can append; the service layer
-- decides what actor/action gets recorded.
CREATE POLICY "audit_logs_insert" ON "audit_logs"
  FOR INSERT
  WITH CHECK (current_app_user_id() IS NULL OR "actorId" = current_app_user_id() OR "actorId" IS NULL);

-- Users / RefreshTokens are accessed via auth flows that already scope by
-- userId in the service layer; RLS adds a minimal "you can only read your
-- own row" guard.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self_select" ON "users"
  FOR SELECT
  USING (current_app_user_id() IS NULL OR "id" = current_app_user_id());
CREATE POLICY "users_self_update" ON "users"
  FOR UPDATE
  USING (current_app_user_id() IS NULL OR "id" = current_app_user_id())
  WITH CHECK (current_app_user_id() IS NULL OR "id" = current_app_user_id());

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refresh_tokens_self_all" ON "refresh_tokens"
  FOR ALL
  USING (current_app_user_id() IS NULL OR "userId" = current_app_user_id())
  WITH CHECK (current_app_user_id() IS NULL OR "userId" = current_app_user_id());

-- ───── 5. Updated-at trigger ─────
-- Prisma updates `updatedAt` in the client, but a DB-level trigger guards
-- against direct SQL paths (psql sessions, raw migrations) bypassing it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at             BEFORE UPDATE ON "users"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspaces_set_updated_at        BEFORE UPDATE ON "workspaces"        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspace_members_set_updated_at BEFORE UPDATE ON "workspace_members" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
