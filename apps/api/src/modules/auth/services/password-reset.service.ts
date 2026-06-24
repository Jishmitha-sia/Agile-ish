import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTokenKind, RefreshTokenRevocationReason } from '@prisma/client';

import { getAppConfig } from '../../../config/config.module.js';
import { EventBus } from '../../../infra/events/events.module.js';
import { MailerService } from '../../../infra/mailer/mailer.service.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import {
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
} from '../events/password-reset.events.js';
import { renderPasswordResetMessage } from '../templates/password-reset.template.js';

import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

const TTL_MINUTES = 60;
const TTL_SECONDS = TTL_MINUTES * 60;

export type RequestOutcome = { kind: 'sent' } | { kind: 'unknown_email' };

export type ConfirmOutcome =
  | { kind: 'reset'; userId: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_used' };

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: EmailTokenService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly mailer: MailerService,
    private readonly events: EventBus,
    private readonly config: ConfigService,
  ) {}

  async request(input: {
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RequestOutcome> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Always-200 from the caller — don't reveal whether the email is registered.
    if (!user?.passwordHash) return { kind: 'unknown_email' };

    const issued = await this.tokens.issue({
      userId: user.id,
      kind: EmailTokenKind.PASSWORD_RESET,
      ttlSeconds: TTL_SECONDS,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const resetUrl = `${getAppConfig(this.config).urls.app}/reset-password?token=${encodeURIComponent(issued.raw)}`;
    const message = renderPasswordResetMessage({
      displayName: user.displayName,
      resetUrl,
      expiresInMinutes: TTL_MINUTES,
    });

    try {
      await this.mailer.send({ to: user.email, ...message });
    } catch (err) {
      this.logger.error({ err, userId: user.id }, 'Failed to send password-reset email');
    }

    await this.events.publish(
      new PasswordResetRequestedEvent({
        userId: user.id,
        email: user.email,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      }),
    );

    return { kind: 'sent' };
  }

  /**
   * Confirm a reset: validate token, hash + store new password, and
   * revoke EVERY active refresh-token family for this user (force a
   * fresh login on all devices — standard recovery-from-compromise
   * posture).
   */
  async confirm(input: {
    token: string;
    newPassword: string;
    ipAddress?: string | undefined;
  }): Promise<ConfirmOutcome> {
    const result = await this.tokens.consume(input.token, EmailTokenKind.PASSWORD_RESET);
    switch (result.kind) {
      case 'invalid':
      case 'wrong_kind':
        return { kind: 'invalid' };
      case 'expired':
        return { kind: 'expired' };
      case 'already_used':
        return { kind: 'already_used' };
      case 'consumed': {
        const newHash = await this.passwords.hash(input.newPassword);
        await this.prisma.user.update({
          where: { id: result.userId },
          data: { passwordHash: newHash },
        });
        // Wipe every active session — if this reset was triggered by an
        // attacker who'd already stolen a refresh cookie, they're out.
        await this.refreshTokens.revokeAllForUser(
          result.userId,
          RefreshTokenRevocationReason.PASSWORD_CHANGED,
        );
        await this.events.publish(
          new PasswordResetCompletedEvent({
            userId: result.userId,
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          }),
        );
        return { kind: 'reset', userId: result.userId };
      }
    }
  }
}
