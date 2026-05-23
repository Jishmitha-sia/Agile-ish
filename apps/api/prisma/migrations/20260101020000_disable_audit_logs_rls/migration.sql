-- ─────────────────────────────────────────────────────────────────────────────
-- Disable RLS on audit_logs.
--
-- Why: Prisma issues `INSERT ... RETURNING *` which evaluates the SELECT
-- policy against the just-inserted row. Auth events (signup/login/logout)
-- have workspaceId = NULL — they're system-scope, not workspace-scope —
-- which the workspace-admin SELECT policy correctly hides. The RETURNING
-- then fails, surfacing as a "violates RLS policy" error on the INSERT.
--
-- Audit logs are an INTERNAL append-only table. There's no public HTTP
-- endpoint that reads from it; controlled access is enforced at the
-- service layer (a future /audit-logs route will accept workspaceSlug as
-- a route param + check membership before querying). RLS on this table
-- adds friction without security value.
--
-- If we later add a user-facing audit-log UI, we'll re-enable RLS with
-- per-command policies that handle the workspaceId=NULL case explicitly.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
