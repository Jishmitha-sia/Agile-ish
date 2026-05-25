import { DomainEvent } from '../../../infra/events/events.module.js';

import type { WorkspaceRole } from '@agile-ish/contracts';


interface WorkspaceCreatedPayload extends Record<string, unknown> {
  workspaceId: string;
  slug: string;
  name: string;
  ownerId: string;
}
export class WorkspaceCreatedEvent extends DomainEvent<WorkspaceCreatedPayload> {
  readonly eventName = 'workspace.created';
  readonly version = 1;
  constructor(public readonly payload: WorkspaceCreatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.ownerId });
  }
}

interface WorkspaceUpdatedPayload extends Record<string, unknown> {
  workspaceId: string;
  actorId: string;
  changes: Record<string, unknown>;
}
export class WorkspaceUpdatedEvent extends DomainEvent<WorkspaceUpdatedPayload> {
  readonly eventName = 'workspace.updated';
  readonly version = 1;
  constructor(public readonly payload: WorkspaceUpdatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface WorkspaceDeletedPayload extends Record<string, unknown> {
  workspaceId: string;
  actorId: string;
}
export class WorkspaceDeletedEvent extends DomainEvent<WorkspaceDeletedPayload> {
  readonly eventName = 'workspace.deleted';
  readonly version = 1;
  constructor(public readonly payload: WorkspaceDeletedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface MemberInvitedPayload extends Record<string, unknown> {
  workspaceId: string;
  actorId: string;
  email: string;
  role: WorkspaceRole;
}
export class WorkspaceMemberInvitedEvent extends DomainEvent<MemberInvitedPayload> {
  readonly eventName = 'workspace.member.invited';
  readonly version = 1;
  constructor(public readonly payload: MemberInvitedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface MemberJoinedPayload extends Record<string, unknown> {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}
export class WorkspaceMemberJoinedEvent extends DomainEvent<MemberJoinedPayload> {
  readonly eventName = 'workspace.member.joined';
  readonly version = 1;
  constructor(public readonly payload: MemberJoinedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.userId });
  }
}

interface MemberRemovedPayload extends Record<string, unknown> {
  workspaceId: string;
  actorId: string;
  userId: string;
}
export class WorkspaceMemberRemovedEvent extends DomainEvent<MemberRemovedPayload> {
  readonly eventName = 'workspace.member.removed';
  readonly version = 1;
  constructor(public readonly payload: MemberRemovedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface MemberRoleChangedPayload extends Record<string, unknown> {
  workspaceId: string;
  actorId: string;
  userId: string;
  fromRole: WorkspaceRole;
  toRole: WorkspaceRole;
}
export class WorkspaceMemberRoleChangedEvent extends DomainEvent<MemberRoleChangedPayload> {
  readonly eventName = 'workspace.member.role_changed';
  readonly version = 1;
  constructor(public readonly payload: MemberRoleChangedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface InvitationCreatedPayload extends Record<string, unknown> {
  invitationId: string;
  workspaceId: string;
  actorId: string;
  email: string;
  role: WorkspaceRole;
  refreshed: boolean;
}
export class WorkspaceInvitationCreatedEvent extends DomainEvent<InvitationCreatedPayload> {
  readonly eventName = 'workspace.invitation.created';
  readonly version = 1;
  constructor(public readonly payload: InvitationCreatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface InvitationAcceptedPayload extends Record<string, unknown> {
  invitationId: string;
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
}
export class WorkspaceInvitationAcceptedEvent extends DomainEvent<InvitationAcceptedPayload> {
  readonly eventName = 'workspace.invitation.accepted';
  readonly version = 1;
  constructor(public readonly payload: InvitationAcceptedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.userId });
  }
}

interface InvitationRevokedPayload extends Record<string, unknown> {
  invitationId: string;
  workspaceId: string;
  actorId: string;
  email: string;
}
export class WorkspaceInvitationRevokedEvent extends DomainEvent<InvitationRevokedPayload> {
  readonly eventName = 'workspace.invitation.revoked';
  readonly version = 1;
  constructor(public readonly payload: InvitationRevokedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}
