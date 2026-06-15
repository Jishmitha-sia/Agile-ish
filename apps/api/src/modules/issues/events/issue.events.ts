import { DomainEvent } from '../../../infra/events/events.module.js';

import type { IssuePriority, IssueStatus, IssueType } from '@agile-ish/contracts';

interface IssueCreatedPayload extends Record<string, unknown> {
  issueId: string;
  projectId: string;
  workspaceId: string;
  actorId: string;
  identifier: string; // e.g. "ENG-42"
  title: string;
  type: IssueType;
}
export class IssueCreatedEvent extends DomainEvent<IssueCreatedPayload> {
  readonly eventName = 'issue.created';
  readonly version = 1;
  constructor(public readonly payload: IssueCreatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface IssueUpdatedPayload extends Record<string, unknown> {
  issueId: string;
  projectId: string;
  workspaceId: string;
  actorId: string;
  identifier: string;
  changes: Record<string, unknown>;
}
export class IssueUpdatedEvent extends DomainEvent<IssueUpdatedPayload> {
  readonly eventName = 'issue.updated';
  readonly version = 1;
  constructor(public readonly payload: IssueUpdatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

/**
 * Status changes ride a dedicated event (separate from generic update) because
 * the Kanban board + future automations care specifically about state
 * transitions — they don't want to filter every `issue.updated` for a status
 * delta. Stays cheap to subscribe to in Batch B + later.
 */
interface IssueStatusChangedPayload extends Record<string, unknown> {
  issueId: string;
  projectId: string;
  workspaceId: string;
  actorId: string;
  identifier: string;
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
}
export class IssueStatusChangedEvent extends DomainEvent<IssueStatusChangedPayload> {
  readonly eventName = 'issue.status_changed';
  readonly version = 1;
  constructor(public readonly payload: IssueStatusChangedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface IssueDeletedPayload extends Record<string, unknown> {
  issueId: string;
  projectId: string;
  workspaceId: string;
  actorId: string;
  identifier: string;
}
export class IssueDeletedEvent extends DomainEvent<IssueDeletedPayload> {
  readonly eventName = 'issue.deleted';
  readonly version = 1;
  constructor(public readonly payload: IssueDeletedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

// Re-export the priority + status types for ergonomic event-handler typing.
export type { IssuePriority, IssueStatus };
