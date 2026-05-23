-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1.5 — email_tokens table.
--
-- Single unified table for email-verification + password-reset flows.
-- Tokens are stored as SHA-256 hashes; the raw token only lives in the
-- email link sent to the user. Single-use (usedAt) and time-limited.
--
-- RLS is left ENABLED on this table with a self-only policy — even though
-- the API never exposes a "list my email tokens" endpoint, defense in depth.
-- The lookup-by-tokenHash path runs as the request user (no app.user_id
-- set yet when the user is following an email link), so the bypass clause
-- handles that case.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "EmailTokenKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE "email_tokens" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "kind"      "EmailTokenKind" NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(512),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "email_tokens_userId_kind_idx" ON "email_tokens" ("userId", "kind");
CREATE INDEX "email_tokens_expiresAt_idx"   ON "email_tokens" ("expiresAt");

-- ───── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE "email_tokens" ENABLE ROW LEVEL SECURITY;

-- SELECT: only your own tokens, OR system context (token-confirm flow runs
-- without app.user_id set since the user isn't logged in yet).
CREATE POLICY "email_tokens_self_select" ON "email_tokens"
  FOR SELECT
  USING (current_app_user_id() IS NULL OR "userId" = current_app_user_id());

-- INSERT: system context only (the request/confirm flows run outside a
-- logged-in session).
CREATE POLICY "email_tokens_insert" ON "email_tokens"
  FOR INSERT
  WITH CHECK (current_app_user_id() IS NULL OR "userId" = current_app_user_id());

-- UPDATE: marks the token as used. System context allowed.
CREATE POLICY "email_tokens_update" ON "email_tokens"
  FOR UPDATE
  USING (current_app_user_id() IS NULL OR "userId" = current_app_user_id())
  WITH CHECK (current_app_user_id() IS NULL OR "userId" = current_app_user_id());

-- DELETE: system-only (used by a scheduled cleanup of expired tokens).
CREATE POLICY "email_tokens_delete" ON "email_tokens"
  FOR DELETE
  USING (current_app_user_id() IS NULL);
