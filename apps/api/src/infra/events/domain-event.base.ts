import { v7 as uuidV7 } from 'uuid';

/**
 * Base class for all domain events.
 *
 * Every module's events extend this so the event bus can route them by
 * `eventName` (a string we keep stable across refactors — the class name
 * may change but the wire name must not).
 *
 * Event payloads are serialisable JSON. NEVER put rich objects (entities,
 * Date instances inside nested structures) on an event — they have to
 * round-trip through Redis pub/sub. Stick to primitives + ISO strings.
 */
export abstract class DomainEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique event id (UUIDv7 — sortable, time-prefixed). */
  public readonly eventId: string = uuidV7();
  /** ISO timestamp of when the event was created. */
  public readonly occurredAt: string = new Date().toISOString();

  /** Stable wire identifier — never refactor this string. */
  public abstract readonly eventName: string;
  /** Event-shape version. Bump when the payload schema changes. */
  public abstract readonly version: number;
  /** Serialisable payload — only primitives, arrays, and plain objects. */
  public abstract readonly payload: TPayload;

  /** Tenant scope, if applicable. Cross-tenant events leave this undefined. */
  public readonly workspaceId?: string;
  /** Actor (user) that caused the event, if applicable. */
  public readonly actorId?: string;

  constructor(opts: { workspaceId?: string; actorId?: string } = {}) {
    if (opts.workspaceId) this.workspaceId = opts.workspaceId;
    if (opts.actorId) this.actorId = opts.actorId;
  }

  toJSON(): SerialisedDomainEvent {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      version: this.version,
      occurredAt: this.occurredAt,
      ...(this.workspaceId ? { workspaceId: this.workspaceId } : {}),
      ...(this.actorId ? { actorId: this.actorId } : {}),
      payload: this.payload,
    };
  }
}

export interface SerialisedDomainEvent {
  eventId: string;
  eventName: string;
  version: number;
  occurredAt: string;
  workspaceId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}
