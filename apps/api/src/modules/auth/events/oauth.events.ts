import { DomainEvent } from '../../../infra/events/events.module.js';

import type { OAuthProvider } from '@prisma/client';


interface OAuthSigninPayload extends Record<string, unknown> {
  userId: string;
  provider: OAuthProvider;
  ipAddress?: string;
}
export class OAuthSigninEvent extends DomainEvent<OAuthSigninPayload> {
  readonly eventName = 'auth.oauth.signin';
  readonly version = 1;
  constructor(public readonly payload: OAuthSigninPayload) {
    super({ actorId: payload.userId });
  }
}

interface OAuthSignupPayload extends Record<string, unknown> {
  userId: string;
  provider: OAuthProvider;
  email: string;
  defaultWorkspaceId: string;
}
export class OAuthSignupEvent extends DomainEvent<OAuthSignupPayload> {
  readonly eventName = 'auth.oauth.signup';
  readonly version = 1;
  constructor(public readonly payload: OAuthSignupPayload) {
    super({ actorId: payload.userId, workspaceId: payload.defaultWorkspaceId });
  }
}

interface OAuthLinkedPayload extends Record<string, unknown> {
  userId: string;
  provider: OAuthProvider;
}
export class OAuthLinkedEvent extends DomainEvent<OAuthLinkedPayload> {
  readonly eventName = 'auth.oauth.linked';
  readonly version = 1;
  constructor(public readonly payload: OAuthLinkedPayload) {
    super({ actorId: payload.userId });
  }
}
