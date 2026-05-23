import { DomainEvent } from '../../../infra/events/events.module.js';

interface PasswordResetRequestedPayload extends Record<string, unknown> {
  userId: string;
  email: string;
  ipAddress?: string;
}
export class PasswordResetRequestedEvent extends DomainEvent<PasswordResetRequestedPayload> {
  readonly eventName = 'auth.password-reset.requested';
  readonly version = 1;
  constructor(public readonly payload: PasswordResetRequestedPayload) {
    super({ actorId: payload.userId });
  }
}

interface PasswordResetCompletedPayload extends Record<string, unknown> {
  userId: string;
  ipAddress?: string;
}
export class PasswordResetCompletedEvent extends DomainEvent<PasswordResetCompletedPayload> {
  readonly eventName = 'auth.password-reset.completed';
  readonly version = 1;
  constructor(public readonly payload: PasswordResetCompletedPayload) {
    super({ actorId: payload.userId });
  }
}
