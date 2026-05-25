-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — Workspace invitations (email-based).
--
-- A WorkspaceInvitation row is created when an ADMIN invites an email
-- that does NOT yet match a User. The raw token only ever exists in the
-- emailed link; we store sha256(token). Acceptance stamps usedAt; admin
-- cancellation stamps revokedAt.
--
-- Partial-unique on (workspaceId, email) WHILE the invitation is still
-- "pending" (usedAt IS NULL AND revokedAt IS NULL). This lets us safely
-- re-issue against an old, dead row without a "slot taken" error.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "workspace_invitations" (
  "id"           TEXT PRIMARY KEY,
  "workspaceId"  TEXT NOT NULL,
  "email"        CITEXT NOT NULL,
  "role"         "WorkspaceRole" NOT NULL,
  "invitedById"  TEXT,
  "tokenHash"    CHAR(64) NOT NULL UNIQUE,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "usedAt"       TIMESTAMP(3),
  "usedByUserId" TEXT,
  "revokedAt"    TIMESTAMP(3),
  "revokedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_invitations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_invitations_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "workspace_invitations_usedByUserId_fkey"
    FOREIGN KEY ("usedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "workspace_invitations_workspaceId_idx" ON "workspace_invitations" ("workspaceId");
CREATE INDEX "workspace_invitations_email_idx"       ON "workspace_invitations" ("email");
CREATE INDEX "workspace_invitations_expiresAt_idx"   ON "workspace_invitations" ("expiresAt");

-- Partial unique — only one pending invitation per (workspace, email).
-- Revoked or accepted rows don't block a fresh invite.
CREATE UNIQUE INDEX "workspace_invitations_pending_unique"
  ON "workspace_invitations" ("workspaceId", "email")
  WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

CREATE TRIGGER workspace_invitations_set_updated_at BEFORE UPDATE ON "workspace_invitations"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───── RLS ──────────────────────────────────────────────────────────────────
-- The accept-invite endpoint must read by tokenHash with no session bound
-- (the user might be unauthenticated). System context (NULL current_app_user_id)
-- is therefore allowed through to enable that path — same pattern as
-- email_tokens. Authenticated reads are scoped to workspace admins.
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invitations_admin_select" ON "workspace_invitations"
  FOR SELECT
  USING (
    current_app_user_id() IS NULL
    OR current_user_is_workspace_admin("workspaceId")
  );

CREATE POLICY "workspace_invitations_admin_insert" ON "workspace_invitations"
  FOR INSERT
  WITH CHECK (
    current_app_user_id() IS NULL
    OR current_user_is_workspace_admin("workspaceId")
  );

CREATE POLICY "workspace_invitations_update" ON "workspace_invitations"
  FOR UPDATE
  USING (
    current_app_user_id() IS NULL
    OR current_user_is_workspace_admin("workspaceId")
  )
  WITH CHECK (
    current_app_user_id() IS NULL
    OR current_user_is_workspace_admin("workspaceId")
  );

CREATE POLICY "workspace_invitations_admin_delete" ON "workspace_invitations"
  FOR DELETE
  USING (
    current_app_user_id() IS NULL
    OR current_user_is_workspace_admin("workspaceId")
  );
