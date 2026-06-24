import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { EmailTokenKind } from '@prisma/client';

import { PrismaService } from '../../../infra/prisma/prisma.service.js';

/**
 * Generation and validation of single-use, time-limited email tokens
 * shared between the email-verification and password-reset flows.
 *
 * Storage model: only `SHA-256(token)` is persisted in `email_tokens`. The
 * raw token value lives only in the link sent to the user's inbox.
 *
 * Token shape: 32 random bytes → 43-character base64url string. Short
 * enough for a tidy URL, long enough to make brute force infeasible
 * (256 bits of entropy).
 */

export interface IssueTokenInput {
  userId: string;
  kind: EmailTokenKind;
  ttlSeconds: number;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedToken {
  /** Raw token — embed in the email link. NEVER log this. */
  raw: string;
  /** DB row id for the token. */
  tokenId: string;
}

export type ConsumeOutcome =
  | { kind: 'consumed'; userId: string; tokenId: string }
  | { kind: 'invalid' } // token never existed
  | { kind: 'expired'; userId: string }
  | { kind: 'already_used'; userId: string }
  | { kind: 'wrong_kind' }; // someone tried to use a reset token as a verification token

@Injectable()
export class EmailTokenService {
  private readonly logger = new Logger(EmailTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issue(input: IssueTokenInput): Promise<IssuedToken> {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);

    // Best effort: drop any prior unconsumed tokens of the same kind for
    // this user, so a fresh request invalidates older outstanding links.
    // (Don't fail the issue path if cleanup hits a transient error.)
    try {
      await this.prisma.emailToken.deleteMany({
        where: {
          userId: input.userId,
          kind: input.kind,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (err) {
      this.logger.warn(
        { err, userId: input.userId, kind: input.kind },
        'Stale token cleanup failed',
      );
    }

    const row = await this.prisma.emailToken.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        tokenHash,
        expiresAt,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      },
    });

    return { raw, tokenId: row.id };
  }

  /**
   * Consume a token. Atomically marks it `usedAt` if it's valid. Returns
   * a tagged result the caller pattern-matches on — never throws for
   * "expected" failures (expired, already-used, wrong-kind).
   */
  async consume(raw: string, expectedKind: EmailTokenKind): Promise<ConsumeOutcome> {
    const tokenHash = this.hashToken(raw);

    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash } });
    if (!row) return { kind: 'invalid' };
    if (row.kind !== expectedKind) return { kind: 'wrong_kind' };
    if (row.usedAt) return { kind: 'already_used', userId: row.userId };
    if (row.expiresAt.getTime() < Date.now()) {
      return { kind: 'expired', userId: row.userId };
    }

    // Conditional UPDATE — if a parallel request beat us to the punch the
    // updateMany returns 0 rows; treat that as already-used.
    const result = await this.prisma.emailToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (result.count === 0) {
      return { kind: 'already_used', userId: row.userId };
    }

    return { kind: 'consumed', userId: row.userId, tokenId: row.id };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
