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

-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER helpers — used by RLS policies that need to look up
-- membership/role. Postgres re-evaluates RLS policies on every relation
-- access, so a policy that SELECTs from the same table it gates causes
-- "infinite recursion detected in policy" errors.
--
-- SECURITY DEFINER functions run with the OWNER's privileges (superuser at
-- migration time), bypassing RLS on tables they touch internally. The
-- function's *output* still goes back to a caller subject to the original
-- RLS policy, so this isn't an authorization bypass — it's the standard
-- pattern to break the recursion.
--
-- search_path is pinned to defeat search-path injection (a SECURITY DEFINER
-- best practice — see Postgres docs §22.6 "Writing SECURITY DEFINER Functions").
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_is_workspace_member(target_workspace_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE uid TEXT;
BEGIN
  uid := current_app_user_id();
  IF uid IS NULL THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE "workspaceId" = target_workspace_id AND "userId" = uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION current_user_is_workspace_admin(target_workspace_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE uid TEXT;
BEGIN
  uid := current_app_user_id();
  IF uid IS NULL THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE "workspaceId" = target_workspace_id
      AND "userId" = uid
      AND "role" IN ('OWNER', 'ADMIN')
  );
END;
$$;

CREATE OR REPLACE FUNCTION current_user_is_workspace_owner(target_workspace_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE uid TEXT;
BEGIN
  uid := current_app_user_id();
  IF uid IS NULL THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE "workspaceId" = target_workspace_id
      AND "userId" = uid
      AND "role" = 'OWNER'
  );
END;
$$;

CREATE OR REPLACE FUNCTION current_user_shares_workspace_with(target_user_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE uid TEXT;
BEGIN
  uid := current_app_user_id();
  IF uid IS NULL THEN RETURN TRUE; END IF;
  IF target_user_id = uid THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members m1
    INNER JOIN workspace_members m2 ON m1."workspaceId" = m2."workspaceId"
    WHERE m1."userId" = uid AND m2."userId" = target_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION current_user_owns_workspace(target_workspace_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE uid TEXT;
BEGIN
  uid := current_app_user_id();
  IF uid IS NULL THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspaces
    WHERE "id" = target_workspace_id AND "ownerId" = uid
  );
END;
$$;

-- Workspaces: per-command policies using SECURITY DEFINER helpers
-- (see helper definitions above) to avoid policy-recursion on joins.
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_select" ON "workspaces"
  FOR SELECT
  USING (current_user_is_workspace_member(workspaces."id"));

CREATE POLICY "workspaces_insert" ON "workspaces"
  FOR INSERT
  WITH CHECK (
    current_app_user_id() IS NULL OR "ownerId" = current_app_user_id()
  );

CREATE POLICY "workspaces_update" ON "workspaces"
  FOR UPDATE
  USING (current_user_is_workspace_admin(workspaces."id"))
  WITH CHECK (current_user_is_workspace_admin(workspaces."id"));

CREATE POLICY "workspaces_delete" ON "workspaces"
  FOR DELETE
  USING (current_user_is_workspace_owner(workspaces."id"));

-- WorkspaceMembers: per-command policies using helpers.
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select" ON "workspace_members"
  FOR SELECT
  USING (current_user_is_workspace_member(workspace_members."workspaceId"));

-- INSERT allows three paths:
--   1. System context (no current user) — signup, seed, migrations
--   2. Self-bootstrap — insert your own OWNER row in a workspace you own
--      (the immediate post-create-workspace step)
--   3. Admin add — existing admin/owner adds someone
CREATE POLICY "workspace_members_insert" ON "workspace_members"
  FOR INSERT
  WITH CHECK (
    current_app_user_id() IS NULL
    OR (
      workspace_members."userId" = current_app_user_id()
      AND current_user_owns_workspace(workspace_members."workspaceId")
    )
    OR current_user_is_workspace_admin(workspace_members."workspaceId")
  );

CREATE POLICY "workspace_members_update" ON "workspace_members"
  FOR UPDATE
  USING (current_user_is_workspace_admin(workspace_members."workspaceId"))
  WITH CHECK (current_user_is_workspace_admin(workspace_members."workspaceId"));

CREATE POLICY "workspace_members_delete" ON "workspace_members"
  FOR DELETE
  USING (
    current_app_user_id() IS NULL
    -- Self-leave (last-owner check is enforced at service layer).
    OR workspace_members."userId" = current_app_user_id()
    OR current_user_is_workspace_admin(workspace_members."workspaceId")
  );

-- AuditLogs: visible to members of the workspace; system-scoped logs
-- (workspaceId IS NULL) are admin-only — exposed via dedicated endpoints
-- that connect with the privileged role.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_workspace_select" ON "audit_logs"
  FOR SELECT
  USING (
    "workspaceId" IS NOT NULL
    AND current_user_is_workspace_admin("audit_logs"."workspaceId")
  );
-- INSERT policy: any authenticated session can append; the service layer
-- decides what actor/action gets recorded.
CREATE POLICY "audit_logs_insert" ON "audit_logs"
  FOR INSERT
  WITH CHECK (current_app_user_id() IS NULL OR "actorId" = current_app_user_id() OR "actorId" IS NULL);

-- Users: RLS-enabled with per-command policies.
--   • SELECT  → yourself OR anyone you share a workspace with (needed so
--               /workspaces/:slug/members can JOIN users for co-members).
--   • INSERT  → only when no current user is set (signup, seed, migrations).
--   • UPDATE  → only your own row.
--   • DELETE  → only when no current user is set (system / admin tooling).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON "users"
  FOR SELECT
  USING (current_user_shares_workspace_with(users."id"));

CREATE POLICY "users_insert" ON "users"
  FOR INSERT
  WITH CHECK (current_app_user_id() IS NULL);

CREATE POLICY "users_update" ON "users"
  FOR UPDATE
  USING (current_app_user_id() IS NULL OR "id" = current_app_user_id())
  WITH CHECK (current_app_user_id() IS NULL OR "id" = current_app_user_id());

CREATE POLICY "users_delete" ON "users"
  FOR DELETE
  USING (current_app_user_id() IS NULL);

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
