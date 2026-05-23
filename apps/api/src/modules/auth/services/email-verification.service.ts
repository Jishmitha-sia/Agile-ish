import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTokenKind } from '@prisma/client';

import { getAppConfig } from '../../../config/config.module.js';
import { EventBus } from '../../../infra/events/events.module.js';
import { MailerService } from '../../../infra/mailer/mailer.service.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import {
  EmailVerificationRequestedEvent,
  EmailVerifiedEvent,
} from '../events/email-verification.events.js';
import { renderEmailVerificationMessage } from '../templates/email-verification.template.js';

import { EmailTokenService } from './email-token.service.js';

const TTL_HOURS = 24;
const TTL_SECONDS = TTL_HOURS * 3600;

export type RequestOutcome =
  | { kind: 'sent' }                   // verification email dispatched
  | { kind: 'already_verified' }       // user is already verified — no-op
  | { kind: 'unknown_email' };         // caller should NOT distinguish this from 'sent' to the client

export type ConfirmOutcome =
  | { kind: 'verified'; userId: string; email: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_used' };

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: EmailTokenService,
    private readonly mailer: MailerService,
    private readonly events: EventBus,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a fresh token and send an email to the user. The CALLER must
   * map all three outcomes to a SINGLE generic response (e.g. "If an
   * account exists for that email, a verification link is on the way")
   * so the endpoint can't be used to enumerate registered emails.
   */
  async request(input: {
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RequestOutcome> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return { kind: 'unknown_email' };
    if (user.emailVerifiedAt) return { kind: 'already_verified' };

    const issued = await this.tokens.issue({
      userId: user.id,
      kind: EmailTokenKind.EMAIL_VERIFICATION,
      ttlSeconds: TTL_SECONDS,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const verifyUrl = `${getAppConfig(this.config).urls.app}/verify-email?token=${encodeURIComponent(issued.raw)}`;
    const message = renderEmailVerificationMessage({
      displayName: user.displayName,
      verifyUrl,
      expiresInHours: TTL_HOURS,
    });

    try {
      await this.mailer.send({ to: user.email, ...message });
    } catch (err) {
      this.logger.error({ err, userId: user.id }, 'Failed to send verification email');
      // Don't expose the failure to the caller — same enumeration concern.
      // The user can retry the request.
    }

    await this.events.publish(
      new EmailVerificationRequestedEvent({
        userId: user.id,
        email: user.email,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      }),
    );

    return { kind: 'sent' };
  }

  /**
   * Confirm a token. Sets `emailVerifiedAt` on the user (idempotent —
   * if already verified, we still mark the token consumed but report
   * success).
   */
  async confirm(rawToken: string): Promise<ConfirmOutcome> {
    const result = await this.tokens.consume(rawToken, EmailTokenKind.EMAIL_VERIFICATION);
    switch (result.kind) {
      case 'invalid':
      case 'wrong_kind':
        return { kind: 'invalid' };
      case 'expired':
        return { kind: 'expired' };
      case 'already_used':
        return { kind: 'already_used' };
      case 'consumed': {
        const user = await this.prisma.user.update({
          where: { id: result.userId },
          data: { emailVerifiedAt: new Date() },
        });
        await this.events.publish(
          new EmailVerifiedEvent({ userId: user.id, email: user.email }),
        );
        return { kind: 'verified', userId: user.id, email: user.email };
      }
    }
  }
}
