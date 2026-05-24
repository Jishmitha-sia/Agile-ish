import { DomainEvent } from '../../../infra/events/events.module.js';

interface ProjectCreatedPayload extends Record<string, unknown> {
  projectId: string;
  workspaceId: string;
  actorId: string;
  slug: string;
  name: string;
  identifierPrefix: string;
}
export class ProjectCreatedEvent extends DomainEvent<ProjectCreatedPayload> {
  readonly eventName = 'project.created';
  readonly version = 1;
  constructor(public readonly payload: ProjectCreatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface ProjectUpdatedPayload extends Record<string, unknown> {
  projectId: string;
  workspaceId: string;
  actorId: string;
  changes: Record<string, unknown>;
}
export class ProjectUpdatedEvent extends DomainEvent<ProjectUpdatedPayload> {
  readonly eventName = 'project.updated';
  readonly version = 1;
  constructor(public readonly payload: ProjectUpdatedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}

interface ProjectDeletedPayload extends Record<string, unknown> {
  projectId: string;
  workspaceId: string;
  actorId: string;
}
export class ProjectDeletedEvent extends DomainEvent<ProjectDeletedPayload> {
  readonly eventName = 'project.deleted';
  readonly version = 1;
  constructor(public readonly payload: ProjectDeletedPayload) {
    super({ workspaceId: payload.workspaceId, actorId: payload.actorId });
  }
}
