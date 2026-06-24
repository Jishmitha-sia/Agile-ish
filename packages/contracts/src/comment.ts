import { z } from 'zod';

import { UserId } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// IssueComment
// ─────────────────────────────────────────────────────────────────────────────

const CommentAuthor = z.object({
  id: UserId,
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
});

export const IssueComment = z.object({
  id: z.string().cuid(),
  issueId: z.string().cuid(),
  author: CommentAuthor,
  body: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type IssueComment = z.infer<typeof IssueComment>;

export const CreateCommentRequest = z.object({
  body: z.string().trim().min(1).max(50_000),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;

export const UpdateCommentRequest = z.object({
  body: z.string().trim().min(1).max(50_000),
});
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequest>;
