import { DomainEvent } from '../../../infra/events/events.module.js';

interface VerificationRequestedPayload extends Record<string, unknown> {
  userId: string;
  email: string;
  ipAddress?: string;
}
export class EmailVerificationRequestedEvent extends DomainEvent<VerificationRequestedPayload> {
  readonly eventName = 'auth.email-verification.requested';
  readonly version = 1;
  constructor(public readonly payload: VerificationRequestedPayload) {
    super({ actorId: payload.userId });
  }
}

interface EmailVerifiedPayload extends Record<string, unknown> {
  userId: string;
  email: string;
}
export class EmailVerifiedEvent extends DomainEvent<EmailVerifiedPayload> {
  readonly eventName = 'auth.email-verification.confirmed';
  readonly version = 1;
  constructor(public readonly payload: EmailVerifiedPayload) {
    super({ actorId: payload.userId });
  }
}
