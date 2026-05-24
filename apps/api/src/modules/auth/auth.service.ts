import { randomUUID } from 'node:crypto';

import {
  type AuthenticatedUser,
  type SessionResponse,
  type UserId,
  type WorkspaceId,
} from '@agile-ish/contracts';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RefreshTokenRevocationReason } from '@prisma/client';

import { EventBus } from '../../infra/events/events.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

import {
  LoginFailedEvent,
  RefreshTokenReusedEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserSignedUpEvent,
} from './events/auth.events.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenService } from './services/token.service.js';

/**
 * Auth orchestrator.
 *
 * Each public method returns a plain object representing the response
 * envelope; the controller takes care of setting cookies and HTTP status.
 * Keeping HTTP concerns out of the service makes these methods reusable
 * from background jobs (e.g. machine-to-machine sessions later).
 */

export interface AuthFlowContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface SignupOrLoginResult {
  session: SessionResponse;
  refreshSecret: string; // raw value to set as a cookie
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly events: EventBus,
  ) {}

  async signup(
    input: {
      email: string;
      password: string;
      displayName: string;
      workspaceName?: string | undefined;
    },
    ctx: AuthFlowContext = {},
  ): Promise<SignupOrLoginResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const workspaceName = input.workspaceName ?? `${input.displayName}'s Workspace`;
    const baseSlug = this.deriveSlug(input.displayName, input.email);

    // We do user + workspace + owner-membership atomically. A partially
    // created user without a workspace would break the login redirect.
    const { user, workspace } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        });
      }

      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      });

      const slug = await this.findAvailableSlug(tx, baseSlug);
      const createdWorkspace = await tx.workspace.create({
        data: {
          slug,
          name: workspaceName,
          ownerId: createdUser.id,
        },
      });
      await tx.workspaceMember.create({
        data: {
          userId: createdUser.id,
          workspaceId: createdWorkspace.id,
          role: 'OWNER',
        },
      });
      await tx.user.update({
        where: { id: createdUser.id },
        data: { defaultWorkspaceId: createdWorkspace.id, lastLoginAt: new Date() },
      });

      return { user: createdUser, workspace: createdWorkspace };
    });

    await this.events.publish(
      new UserSignedUpEvent({
        userId: user.id,
        email: user.email,
        defaultWorkspaceId: workspace.id,
      }),
    );

    return await this.issueSession(user.id, ctx);
  }

  async login(
    input: { email: string; password: string },
    ctx: AuthFlowContext = {},
  ): Promise<SignupOrLoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user?.passwordHash) {
      await this.events.publish(
        new LoginFailedEvent({
          email: input.email,
          reason: 'unknown_user',
          ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
        }),
      );
      // Same error shape as bad password — don't reveal which side failed.
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    const upgradedHash = await this.passwords.verifyAndUpgrade(user.passwordHash, input.password);
    // verifyAndUpgrade returns null on either "verification failed" OR
    // "verification succeeded, no upgrade needed". Disambiguate:
    const ok = upgradedHash !== null || (await this.passwords.verify(user.passwordHash, input.password));
    if (!ok) {
      await this.events.publish(
        new LoginFailedEvent({
          email: input.email,
          reason: 'bad_password',
          ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
        }),
      );
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    if (upgradedHash) {
      // Transparent re-hash at stronger params — fire-and-forget; never
      // block login on the upgrade write.
      void this.prisma.user
        .update({ where: { id: user.id }, data: { passwordHash: upgradedHash } })
        .catch((err) => this.logger.warn({ err, userId: user.id }, 'Password rehash failed'));
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return await this.issueSession(user.id, ctx);
  }

  async refresh(
    presentedRaw: string,
    ctx: AuthFlowContext = {},
  ): Promise<SignupOrLoginResult> {
    const result = await this.refreshTokens.rotate({
      presentedRaw,
      ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
    });

    if (result.kind === 'invalid') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid session' });
    }
    if (result.kind === 'expired') {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Session expired' });
    }
    if (result.kind === 'reused') {
      await this.events.publish(
        new RefreshTokenReusedEvent({
          userId: result.userId,
          familyId: result.familyId,
          ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
        }),
      );
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Session compromised — please log in again',
      });
    }

    return await this.assembleSession(result.userId, result.result.secret.raw, result.result.tokenId);
  }

  async logout(refreshRaw: string | undefined, userId: string): Promise<void> {
    if (refreshRaw) {
      const hash = this.tokens.hashRefreshSecret(refreshRaw);
      await this.refreshTokens.revoke(hash, RefreshTokenRevocationReason.LOGOUT);
    }
    await this.events.publish(
      new UserLoggedOutEvent({
        userId,
        sessionId: '', // sessionId is in the JWT; logout from the controller has access to it
      }),
    );
  }

  async loadCurrentUser(userId: UserId): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          // Suppress memberships of soft-deleted workspaces — the row stays
          // in the DB for restoration tooling, but it should not appear in
          // /auth/me's payload or in the sidebar switcher.
          where: { workspace: { deletedAt: null } },
          include: {
            workspace: { select: { id: true, slug: true, name: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'User no longer exists' });
    }
    return {
      id: user.id as UserId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      defaultWorkspaceId: (user.defaultWorkspaceId as WorkspaceId | null) ?? null,
      memberships: user.memberships.map((m) => ({
        workspaceId: m.workspaceId as WorkspaceId,
        workspaceSlug: m.workspace.slug,
        workspaceName: m.workspace.name,
        role: m.role,
      })),
    };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private async issueSession(userId: string, ctx: AuthFlowContext): Promise<SignupOrLoginResult> {
    const family = await this.refreshTokens.createFamily({
      userId,
      ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
    });
    const result = await this.assembleSession(userId, family.secret.raw, family.tokenId);

    await this.events.publish(
      new UserLoggedInEvent({
        userId,
        sessionId: family.tokenId,
        ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
        ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      }),
    );

    return result;
  }

  private async assembleSession(
    userId: string,
    refreshSecretRaw: string,
    sessionId: string,
  ): Promise<SignupOrLoginResult> {
    const user = await this.loadCurrentUser(userId as UserId);
    const access = await this.tokens.signAccessToken({
      userId: userId as UserId,
      email: user.email,
      sessionId,
    });
    return {
      refreshSecret: refreshSecretRaw,
      session: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        user,
      },
    };
  }

  private deriveSlug(displayName: string, email: string): string {
    const candidate = (displayName || (email.split('@')[0] ?? 'workspace'))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
    return candidate.length >= 3 ? candidate : `ws-${randomUUID().slice(0, 6)}`;
  }

  /** Find an unused slug by appending a short suffix on collision. */
  private async findAvailableSlug(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    base: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`;
      const taken = await tx.workspace.findUnique({ where: { slug } });
      if (!taken) return slug;
    }
    // Extremely unlikely fallback: random 8-char slug.
    return `ws-${randomUUID().slice(0, 8)}`;
  }
}
