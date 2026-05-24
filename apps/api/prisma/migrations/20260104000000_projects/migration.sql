-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — Projects.
--
-- One Workspace has many Projects. Composite uniques on (workspaceId, slug)
-- and (workspaceId, identifierPrefix). RLS policies inherit from the parent
-- workspace's membership graph via the existing current_user_is_workspace_*
-- SECURITY DEFINER helpers (see 20260101000000_init).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "ProjectVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE "projects" (
  "id"               TEXT PRIMARY KEY,
  "workspaceId"      TEXT NOT NULL,
  "slug"             VARCHAR(32) NOT NULL,
  "name"             VARCHAR(80) NOT NULL,
  "description"      VARCHAR(500),
  "identifierPrefix" VARCHAR(8)  NOT NULL,
  "issueCounter"     INTEGER     NOT NULL DEFAULT 0,
  "visibility"       "ProjectVisibility" NOT NULL DEFAULT 'PUBLIC',
  "leadUserId"       TEXT,
  "archivedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "deletedAt"        TIMESTAMP(3),
  CONSTRAINT "projects_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "projects_leadUserId_fkey"
    FOREIGN KEY ("leadUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "projects_workspaceId_slug_key"             UNIQUE ("workspaceId", "slug"),
  CONSTRAINT "projects_workspaceId_identifierPrefix_key" UNIQUE ("workspaceId", "identifierPrefix")
);

CREATE INDEX "projects_workspaceId_deletedAt_idx" ON "projects" ("workspaceId", "deletedAt");
CREATE INDEX "projects_leadUserId_idx"             ON "projects" ("leadUserId");

CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON "projects"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───── RLS ──────────────────────────────────────────────────────────────────
-- Project visibility inherits from workspace membership: any workspace member
-- can SELECT projects in their workspace, ADMIN+ can INSERT/UPDATE/DELETE.
-- The system context (current_app_user_id() IS NULL, used by service startup
-- / migrations) is allowed by the underlying SECURITY DEFINER helpers.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_member_select" ON "projects"
  FOR SELECT
  USING (current_user_is_workspace_member("workspaceId"));

CREATE POLICY "projects_admin_insert" ON "projects"
  FOR INSERT
  WITH CHECK (current_user_is_workspace_admin("workspaceId"));

CREATE POLICY "projects_admin_update" ON "projects"
  FOR UPDATE
  USING (current_user_is_workspace_admin("workspaceId"))
  WITH CHECK (current_user_is_workspace_admin("workspaceId"));

CREATE POLICY "projects_admin_delete" ON "projects"
  FOR DELETE
  USING (current_user_is_workspace_admin("workspaceId"));
