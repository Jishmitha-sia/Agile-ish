import { DomainEvent } from '../../../infra/events/events.module.js';

/**
 * Auth domain events.
 *
 * The `eventName` strings are part of the cross-instance wire contract.
 * NEVER refactor these strings — bump `version` and add a migration handler
 * if the payload shape needs to change.
 */

interface UserSignedUpPayload extends Record<string, unknown> {
  userId: string;
  email: string;
  defaultWorkspaceId: string;
}
export class UserSignedUpEvent extends DomainEvent<UserSignedUpPayload> {
  readonly eventName = 'auth.user.signed-up';
  readonly version = 1;
  constructor(public readonly payload: UserSignedUpPayload) {
    super({ actorId: payload.userId, workspaceId: payload.defaultWorkspaceId });
  }
}

interface UserLoggedInPayload extends Record<string, unknown> {
  userId: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
}
export class UserLoggedInEvent extends DomainEvent<UserLoggedInPayload> {
  readonly eventName = 'auth.user.logged-in';
  readonly version = 1;
  constructor(public readonly payload: UserLoggedInPayload) {
    super({ actorId: payload.userId });
  }
}

interface UserLoggedOutPayload extends Record<string, unknown> {
  userId: string;
  sessionId: string;
}
export class UserLoggedOutEvent extends DomainEvent<UserLoggedOutPayload> {
  readonly eventName = 'auth.user.logged-out';
  readonly version = 1;
  constructor(public readonly payload: UserLoggedOutPayload) {
    super({ actorId: payload.userId });
  }
}

interface LoginFailedPayload extends Record<string, unknown> {
  email: string;
  reason: 'unknown_user' | 'bad_password' | 'rate_limited';
  ipAddress?: string;
}
export class LoginFailedEvent extends DomainEvent<LoginFailedPayload> {
  readonly eventName = 'auth.login.failed';
  readonly version = 1;
  constructor(public readonly payload: LoginFailedPayload) {
    super();
  }
}

interface RefreshTokenReusedPayload extends Record<string, unknown> {
  userId: string;
  familyId: string;
  ipAddress?: string;
}
export class RefreshTokenReusedEvent extends DomainEvent<RefreshTokenReusedPayload> {
  readonly eventName = 'auth.refresh.reused';
  readonly version = 1;
  constructor(public readonly payload: RefreshTokenReusedPayload) {
    super({ actorId: payload.userId });
  }
}
