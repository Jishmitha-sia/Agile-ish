import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getAppConfig } from '../../config/config.module.js';
import { RedisService } from '../redis/redis.service.js';

import { type DomainEvent, type SerialisedDomainEvent } from './domain-event.base.js';

/**
 * Cross-instance domain event bus.
 *
 * Publish/subscribe semantics:
 *   • In-process subscribers (registered via `subscribe()`) are called
 *     synchronously after the Redis publish — guarantees local handlers
 *     see the event even if Redis is briefly unavailable.
 *   • Out-of-process subscribers (other API replicas) receive the event
 *     via Redis pub/sub on channel `<namespace>:events:<eventName>`.
 *
 * This is intentionally fire-and-forget. Reliable delivery requirements
 * (e.g. emit-on-commit, retries) use BullMQ queues instead — handlers
 * dequeue jobs that subscribers enqueue from events. Keeps fast-path
 * publish cheap and lets us pick the right consistency primitive per
 * use-case.
 *
 * The microservices migration path: when a module is extracted, its
 * subscribers move with it. Producers keep calling `publish()`; consumers
 * just live in a different process. No code change.
 */

export type EventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent,
) => void | Promise<void>;

@Injectable()
export class EventBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly channelPrefix: string;
  // Track in-flight handler invocations so shutdown can drain them.
  private readonly inflight = new Set<Promise<unknown>>();
  private subscribed = false;
  // Per-process identifier — stamped on published events so the same
  // instance can recognise and drop its own Redis pub/sub echo (we
  // already dispatched locally before publishing).
  private readonly instanceId = randomUUID();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    const cfg = getAppConfig(config);
    this.channelPrefix = `${cfg.redis.namespace}:events:`;
  }

  async onModuleInit(): Promise<void> {
    // Pattern-subscribe once. Handlers register lazily.
    await this.redis.subscriber.psubscribe(`${this.channelPrefix}*`);
    this.redis.subscriber.on('pmessage', (_pattern, channel, message) => {
      void this.dispatchExternal(channel, message);
    });
    this.subscribed = true;
    this.logger.log(`EventBus subscribed to ${this.channelPrefix}*`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscribed) {
      await this.redis.subscriber.punsubscribe(`${this.channelPrefix}*`);
    }
    // Best-effort drain of in-flight handlers. Don't hang the process forever.
    await Promise.race([
      Promise.allSettled([...this.inflight]),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }

  /**
   * Publish an event. Local handlers run immediately; remote replicas
   * receive the event via Redis pub/sub. Returns once the Redis publish
   * is acknowledged — does NOT await handler completion.
   */
  async publish<TEvent extends DomainEvent>(event: TEvent): Promise<void> {
    const channel = `${this.channelPrefix}${event.eventName}`;
    // Stamp the payload with our instance id so the echo we'll receive
    // via our own Redis subscription is recognised and dropped.
    const payload = JSON.stringify({ ...event.toJSON(), __originInstance: this.instanceId });

    // Fire local handlers ourselves so this instance doesn't depend on a
    // round-trip through Redis to see its own events.
    this.dispatchLocal(event);

    try {
      await this.redis.publisher.publish(channel, payload);
    } catch (err) {
      this.logger.error({ err, eventName: event.eventName }, 'Failed to publish to Redis');
      // Don't throw — local handlers already ran. Operationally, a Redis
      // outage degrades cross-instance delivery but doesn't fail the request.
    }
  }

  /**
   * Register a local handler for an event. Returns an unsubscribe function.
   * Subscribers usually register in module `onApplicationBootstrap`.
   */
  subscribe<TEvent extends DomainEvent = DomainEvent>(
    eventName: string,
    handler: EventHandler<TEvent>,
  ): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler as EventHandler);
    return () => {
      this.handlers.get(eventName)?.delete(handler as EventHandler);
    };
  }

  private dispatchLocal(event: DomainEvent): void {
    const handlers = this.handlers.get(event.eventName);
    if (!handlers) return;
    for (const h of handlers) {
      const promise = Promise.resolve()
        .then(() => h(event))
        .catch((err: unknown) => {
          this.logger.error({ err, eventName: event.eventName }, 'Local handler failed');
        })
        .finally(() => this.inflight.delete(promise));
      this.inflight.add(promise);
    }
  }

  private async dispatchExternal(channel: string, raw: string): Promise<void> {
    const eventName = channel.slice(this.channelPrefix.length);
    let parsed: SerialisedDomainEvent & { __originInstance?: string };
    try {
      parsed = JSON.parse(raw) as SerialisedDomainEvent & { __originInstance?: string };
    } catch (err) {
      this.logger.warn({ err, channel }, 'Dropping malformed event message');
      return;
    }

    // Drop our own echo — we already dispatched locally before publishing.
    if (parsed.__originInstance === this.instanceId) return;

    // Reconstruct as a plain object preserving the DomainEvent contract
    // for local handlers — we don't materialise the original class, so
    // handlers must not rely on `instanceof` of concrete event classes.
    // Local-only producers always see their own class; cross-process
    // handlers always see the plain object form.
    const surrogate = {
      eventName,
      eventId: parsed.eventId,
      version: parsed.version,
      occurredAt: parsed.occurredAt,
      workspaceId: parsed.workspaceId,
      actorId: parsed.actorId,
      payload: parsed.payload,
      toJSON: () => parsed,
    } as unknown as DomainEvent;

    this.dispatchLocal(surrogate);
  }
}
