import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { RefreshTokenRevocationReason } from '@prisma/client';

import { PrismaService } from '../../../infra/prisma/prisma.service.js';

import { TokenService, type RefreshTokenSecret } from './token.service.js';

/**
 * Refresh-token rotation service implementing OWASP-recommended reuse
 * detection.
 *
 * Lifecycle:
 *   • createFamily()  — called on login. Creates a new family root.
 *   • rotate()        — called on /auth/refresh. Marks the current token
 *                       as ROTATED, creates a new descendant, returns
 *                       both the new opaque secret and its DB row id.
 *   • revoke()        — called on logout. Marks a single token as LOGOUT.
 *   • detectReuse()   — called when a REVOKED token is presented. Marks
 *                       every member of the family as REUSED and emits a
 *                       security event. The user is forced to re-login.
 *
 * We store only `SHA-256(secret)` in the DB. A leaked database does not
 * yield usable tokens. The raw secret only lives in the httpOnly cookie
 * sent to the browser and in the user's memory of "logged in".
 *
 * The rotation+reuse-detection algorithm:
 *
 *     [login] ─► A0 (active)
 *                │ /refresh
 *                ▼
 *                A0 → ROTATED   A1 (active)
 *                                │ /refresh
 *                                ▼
 *                                A1 → ROTATED   A2 (active)
 *
 *     If someone replays A0 (e.g. cookie was stolen before rotation):
 *     A0.revokedReason !== null → REUSE detected → revoke A1, A2 with
 *     reason=REUSED. The legitimate user's session ends.
 */

export interface RotateResult {
  secret: RefreshTokenSecret;
  tokenId: string;
  familyId: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Create a fresh refresh-token family on login.
   * The returned secret is sent as a cookie; the hash is persisted.
   */
  async createFamily(input: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RotateResult> {
    const familyId = randomUUID();
    const secret = this.tokens.generateRefreshSecret();
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtl * 1000);

    const row = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        familyId,
        tokenHash: secret.hash,
        expiresAt,
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      },
    });

    return { secret, tokenId: row.id, familyId };
  }

  /**
   * Rotate a presented refresh token.
   *
   * Returns:
   *   • { kind: 'rotated', ... } on success
   *   • { kind: 'reused', ... } if a revoked token was presented (security)
   *   • { kind: 'invalid' } if the token doesn't match any known hash
   *
   * The caller maps these to HTTP 200 (set new cookie) and 401 (kill all
   * sessions, clear cookie) respectively.
   */
  async rotate(input: {
    presentedRaw: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<
    | { kind: 'rotated'; userId: string; result: RotateResult }
    | { kind: 'reused'; userId: string; familyId: string }
    | { kind: 'invalid' }
    | { kind: 'expired'; userId: string }
  > {
    const hash = this.tokens.hashRefreshSecret(input.presentedRaw);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!existing) return { kind: 'invalid' };

    if (existing.revokedAt) {
      // Reuse detected — kill the entire family. Even if the legitimate user
      // didn't compromise their cookie, we err on the side of forcing re-auth
      // because we can't distinguish replay from coincidence.
      await this.revokeFamily(existing.familyId, RefreshTokenRevocationReason.REUSED);
      this.logger.warn(
        { userId: existing.userId, familyId: existing.familyId, tokenId: existing.id },
        'Refresh-token reuse detected — family revoked',
      );
      return { kind: 'reused', userId: existing.userId, familyId: existing.familyId };
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), revokedReason: RefreshTokenRevocationReason.EXPIRED },
      });
      return { kind: 'expired', userId: existing.userId };
    }

    // Happy path: rotate.
    const newSecret = this.tokens.generateRefreshSecret();
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtl * 1000);

    const rotated = await this.prisma.$transaction(async (tx) => {
      const newRow = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: newSecret.hash,
          parentId: existing.id,
          expiresAt,
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          revokedReason: RefreshTokenRevocationReason.ROTATED,
          replacedById: newRow.id,
        },
      });
      return newRow;
    });

    return {
      kind: 'rotated',
      userId: existing.userId,
      result: { secret: newSecret, tokenId: rotated.id, familyId: existing.familyId },
    };
  }

  /** Revoke a single refresh token (logout of one session). */
  async revoke(tokenHash: string, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Revoke every token in a family — used on reuse detection or password change. */
  async revokeFamily(familyId: string, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Revoke every active token for a user — used on password change. */
  async revokeAllForUser(userId: string, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Resolve a refresh token to its row (used by /auth/refresh + /auth/logout). */
  async findByRaw(raw: string) {
    const hash = this.tokens.hashRefreshSecret(raw);
    return this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  }
}
