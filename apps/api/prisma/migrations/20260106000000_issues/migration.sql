-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Issues.
--
-- The unit of work inside a Project. Identifier `<prefix>-<number>` is minted
-- atomically from Project.issueCounter inside a transaction (see
-- IssuesService.create). `(projectId, number)` is composite-unique.
--
-- RLS reaches workspace membership via the parent project row — there's no
-- denormalised `workspaceId` on issues. The SELECT policy joins projects to
-- discover which workspace the issue belongs to, then defers to the existing
-- `current_user_is_workspace_{member,admin}()` SECURITY DEFINER helpers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "IssueStatus"   AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE "IssuePriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "issues" (
  "id"              TEXT PRIMARY KEY,
  "projectId"       TEXT NOT NULL,
  "number"          INTEGER NOT NULL,
  "title"           VARCHAR(200) NOT NULL,
  "description"     TEXT,
  "status"          "IssueStatus"   NOT NULL DEFAULT 'BACKLOG',
  "priority"        "IssuePriority" NOT NULL DEFAULT 'NONE',
  "assigneeUserId"  TEXT,
  "createdByUserId" TEXT,
  "dueDate"         TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "deletedAt"       TIMESTAMP(3),
  CONSTRAINT "issues_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "issues_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "issues_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "issues_projectId_number_key" UNIQUE ("projectId", "number")
);

CREATE INDEX "issues_projectId_status_deletedAt_idx" ON "issues" ("projectId", "status", "deletedAt");
CREATE INDEX "issues_assigneeUserId_idx"             ON "issues" ("assigneeUserId");
CREATE INDEX "issues_createdByUserId_idx"            ON "issues" ("createdByUserId");
CREATE INDEX "issues_deletedAt_idx"                  ON "issues" ("deletedAt");

CREATE TRIGGER issues_set_updated_at BEFORE UPDATE ON "issues"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───── RLS ──────────────────────────────────────────────────────────────────
-- Membership check reaches through the parent project's workspaceId. The
-- subquery is fast because projects.id is the primary key. System context
-- (current_app_user_id() IS NULL) is allowed by the underlying helpers.
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues_member_select" ON "issues"
  FOR SELECT
  USING (
    current_user_is_workspace_member(
      (SELECT "workspaceId" FROM "projects" WHERE "id" = "issues"."projectId")
    )
  );

CREATE POLICY "issues_member_insert" ON "issues"
  FOR INSERT
  WITH CHECK (
    current_user_is_workspace_member(
      (SELECT "workspaceId" FROM "projects" WHERE "id" = "issues"."projectId")
    )
  );

CREATE POLICY "issues_member_update" ON "issues"
  FOR UPDATE
  USING (
    current_user_is_workspace_member(
      (SELECT "workspaceId" FROM "projects" WHERE "id" = "issues"."projectId")
    )
  )
  WITH CHECK (
    current_user_is_workspace_member(
      (SELECT "workspaceId" FROM "projects" WHERE "id" = "issues"."projectId")
    )
  );

CREATE POLICY "issues_admin_delete" ON "issues"
  FOR DELETE
  USING (
    current_user_is_workspace_admin(
      (SELECT "workspaceId" FROM "projects" WHERE "id" = "issues"."projectId")
    )
  );
