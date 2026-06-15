-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Issue types.
--
-- Orthogonal to status. Adds a fixed enum (BUG / FEATURE / CHORE / TASK)
-- so users can categorise work by what it IS (defect vs new capability vs
-- cleanup) on top of where it is in the workflow. Default TASK keeps the
-- field unobtrusive for existing rows + new issues that don't care.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "IssueType" AS ENUM ('BUG', 'FEATURE', 'CHORE', 'TASK');

ALTER TABLE "issues"
  ADD COLUMN "type" "IssueType" NOT NULL DEFAULT 'TASK';

CREATE INDEX "issues_projectId_type_deletedAt_idx" ON "issues" ("projectId", "type", "deletedAt");
