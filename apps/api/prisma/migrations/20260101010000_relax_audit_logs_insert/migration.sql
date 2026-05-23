-- ─────────────────────────────────────────────────────────────────────────────
-- Relax audit_logs INSERT policy.
--
-- The original policy required actorId = current_app_user_id() when both
-- were set. In practice the audit write happens OUTSIDE any
-- withRequestContext() scope (the audit subscriber runs in response to
-- events on the global Prisma client), so current_app_user_id() is
-- expected to be NULL — but Postgres connection pooling + Prisma's
-- session-level behavior can leak a previous request's setting, causing
-- the policy to deny.
--
-- The correct design: audit_logs is an internal, append-only table with no
-- public INSERT endpoint. The service layer controls what gets written;
-- RLS on INSERT adds no security value (only failure surface). RLS on
-- SELECT (workspace-admin-only read) is what matters and stays as-is.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs_insert" ON "audit_logs";

CREATE POLICY "audit_logs_insert" ON "audit_logs"
  FOR INSERT
  WITH CHECK (true);
