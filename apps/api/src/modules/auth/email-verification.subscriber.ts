import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { EventBus } from '../../infra/events/events.module.js';

import { EmailVerificationService } from './services/email-verification.service.js';

/**
 * Auto-sends a verification email whenever a new user signs up.
 *
 * Lives as an event subscriber rather than a direct call inside
 * AuthService.signup so the signup flow stays loosely coupled — adding
 * future side effects (welcome email, analytics ping, default project
 * creation) is purely additive.
 */
@Injectable()
export class EmailVerificationSubscriber implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailVerificationSubscriber.name);
  private unsubscribers: (() => void)[] = [];

  constructor(
    private readonly events: EventBus,
    private readonly verification: EmailVerificationService,
  ) {}

  onApplicationBootstrap(): void {
    const off = this.events.subscribe('auth.user.signed-up', async (event) => {
      const payload = event.toJSON().payload as { userId?: string; email?: string };
      if (!payload.email) return;
      try {
        await this.verification.request({ email: payload.email });
      } catch (err) {
        // Never let a side-effect failure surface to the user — the
        // signup transaction already committed by the time this fires.
        this.logger.warn({ err, userId: payload.userId }, 'Auto-verification email failed');
      }
    });
    this.unsubscribers.push(off);
    this.logger.log('Auto-send verification email on signup wired up');
  }
}
