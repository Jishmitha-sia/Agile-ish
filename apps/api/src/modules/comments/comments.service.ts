import {
  type CreateCommentRequest,
  type IssueComment,
  type UpdateCommentRequest,
  type UserId,
} from '@agile-ish/contracts';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByIssue(issueId: string): Promise<IssueComment[]> {
    const rows = await this.prisma.issueComment.findMany({
      where: { issueId, deletedAt: null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    actorId: UserId,
    issueId: string,
    input: CreateCommentRequest,
  ): Promise<IssueComment> {
    // Verify issue exists
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, deletedAt: null },
    });
    if (!issue) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Issue not found' });

    const row = await this.prisma.issueComment.create({
      data: { issueId, authorId: actorId, body: input.body },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    return this.toDto(row);
  }

  async update(
    actorId: UserId,
    commentId: string,
    patch: UpdateCommentRequest,
  ): Promise<IssueComment> {
    const existing = await this.prisma.issueComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Comment not found' });
    if (existing.authorId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only edit your own comments',
      });
    }

    const row = await this.prisma.issueComment.update({
      where: { id: commentId },
      data: { body: patch.body },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    return this.toDto(row);
  }

  async deleteComment(actorId: UserId, commentId: string): Promise<void> {
    const existing = await this.prisma.issueComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Comment not found' });
    if (existing.authorId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only delete your own comments',
      });
    }

    await this.prisma.issueComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private toDto(row: {
    id: string;
    issueId: string;
    author: { id: string; displayName: string; avatarUrl: string | null };
    body: string;
    createdAt: Date;
    updatedAt: Date;
  }): IssueComment {
    return {
      id: row.id,
      issueId: row.issueId,
      author: {
        id: row.author.id as UserId,
        displayName: row.author.displayName,
        avatarUrl: row.author.avatarUrl,
      },
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
