import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';

import { EventBus } from '../../../infra/events/events.module.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import {
  OAuthLinkedEvent,
  OAuthSigninEvent,
  OAuthSignupEvent,
} from '../events/oauth.events.js';

/**
 * The find-or-create-and-link flow for OAuth.
 *
 * Three cases the callback handler hits:
 *
 *   1. EXISTING LINK
 *      OAuthAccount(provider, providerUserId) already exists.
 *      → log the user in.
 *
 *   2. NEW LINK on an existing user
 *      OAuthAccount missing, but a User with the OAuth-provided email
 *      already exists AND the provider says the email is verified.
 *      → attach OAuthAccount to that user, log them in.
 *      (If email NOT verified, we refuse the auto-link to prevent
 *      account takeover via fake email registrations.)
 *
 *   3. BRAND NEW USER
 *      Nothing matches.
 *      → create user + personal workspace + OWNER membership +
 *        OAuthAccount, log them in.
 *
 * Like the password signup flow, brand-new-user creation is wrapped in a
 * transaction so a partial state never persists.
 */

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  handle?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  expiresAt?: Date | undefined;
}

export type OAuthOutcome =
  | { kind: 'signed_in'; userId: string }
  | { kind: 'linked';    userId: string }
  | { kind: 'signed_up'; userId: string }
  | { kind: 'email_collision' }; // existing password account with same email, unverified provider email

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  async upsertFromProfile(profile: OAuthProfile): Promise<OAuthOutcome> {
    // 1. Existing link?
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
    });
    if (existing) {
      // Refresh the token snapshot in case the provider rotated.
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          ...(profile.accessToken ? { accessToken: profile.accessToken } : {}),
          ...(profile.refreshToken ? { refreshToken: profile.refreshToken } : {}),
          ...(profile.expiresAt ? { expiresAt: profile.expiresAt } : {}),
          ...(profile.email ? { providerEmail: profile.email } : {}),
          ...(profile.handle ? { providerHandle: profile.handle } : {}),
        },
      });
      await this.events.publish(
        new OAuthSigninEvent({ userId: existing.userId, provider: profile.provider }),
      );
      return { kind: 'signed_in', userId: existing.userId };
    }

    // 2. Existing user by email — try to link.
    if (profile.email) {
      const userByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (userByEmail) {
        if (!profile.emailVerified) {
          // Refuse silent linking — the provider hasn't proved ownership
          // of this email, and a malicious user could spoof it.
          return { kind: 'email_collision' };
        }
        await this.prisma.oAuthAccount.create({
          data: {
            userId: userByEmail.id,
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            providerEmail: profile.email,
            ...(profile.handle ? { providerHandle: profile.handle } : {}),
            ...(profile.accessToken ? { accessToken: profile.accessToken } : {}),
            ...(profile.refreshToken ? { refreshToken: profile.refreshToken } : {}),
            ...(profile.expiresAt ? { expiresAt: profile.expiresAt } : {}),
          },
        });
        await this.events.publish(
          new OAuthLinkedEvent({ userId: userByEmail.id, provider: profile.provider }),
        );
        // If the user wasn't email-verified yet, the provider just proved
        // ownership — set verifiedAt so the verification banner clears.
        if (!userByEmail.emailVerifiedAt) {
          await this.prisma.user.update({
            where: { id: userByEmail.id },
            data: { emailVerifiedAt: new Date() },
          });
        }
        return { kind: 'linked', userId: userByEmail.id };
      }
    }

    // 3. Brand new user. Atomically create user + workspace + member + oauth.
    const baseSlug = this.deriveSlug(profile.displayName, profile.email);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: profile.email,
          displayName: profile.displayName,
          // OAuth user has no local password; null is allowed by schema.
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
        },
      });
      const slug = await this.findAvailableSlug(tx, baseSlug);
      const workspace = await tx.workspace.create({
        data: {
          slug,
          name: `${profile.displayName}'s Workspace`,
          ownerId: user.id,
        },
      });
      await tx.workspaceMember.create({
        data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: workspace.id, lastLoginAt: new Date() },
      });
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          providerEmail: profile.email,
          ...(profile.handle ? { providerHandle: profile.handle } : {}),
          ...(profile.accessToken ? { accessToken: profile.accessToken } : {}),
          ...(profile.refreshToken ? { refreshToken: profile.refreshToken } : {}),
          ...(profile.expiresAt ? { expiresAt: profile.expiresAt } : {}),
        },
      });
      return { user, workspace };
    });

    await this.events.publish(
      new OAuthSignupEvent({
        userId: created.user.id,
        provider: profile.provider,
        email: created.user.email,
        defaultWorkspaceId: created.workspace.id,
      }),
    );
    return { kind: 'signed_up', userId: created.user.id };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private deriveSlug(displayName: string, email: string): string {
    const candidate = (displayName || (email.split('@')[0] ?? 'workspace'))
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
    return candidate.length >= 3 ? candidate : `ws-${randomUUID().slice(0, 6)}`;
  }

  private async findAvailableSlug(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    base: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`;
      // eslint-disable-next-line no-await-in-loop
      const taken = await tx.workspace.findUnique({ where: { slug } });
      if (!taken) return slug;
    }
    return `ws-${randomUUID().slice(0, 8)}`;
  }
}
