import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

import { getAppConfig } from '../../config/config.module.js';

/**
 * Singleton Redis facade.
 *
 * Three logical clients share one Redis instance:
 *   • `client`    — general-purpose KV / cache (the most common).
 *   • `publisher` — pub/sub publishing (no subscriptions).
 *   • `subscriber`— pub/sub subscribing (cannot issue normal commands once
 *                   subscribed; this is a Redis protocol constraint).
 *
 * BullMQ owns its own connections (configured in BullModule); we do not
 * share them — BullMQ needs `maxRetriesPerRequest: null` which conflicts
 * with the defaults we want for cache reads.
 */

const baseOptions = (url: string, keyPrefix: string): RedisOptions => ({
  lazyConnect: false,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
  keyPrefix: `${keyPrefix}:`,
});

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;
  public readonly publisher: Redis;
  public readonly subscriber: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const cfg = getAppConfig(config);
    const opts = baseOptions(cfg.redis.url, cfg.redis.namespace);
    this.client = new Redis(cfg.redis.url, opts);
    this.publisher = new Redis(cfg.redis.url, opts);
    this.subscriber = new Redis(cfg.redis.url, opts);

    for (const [name, c] of [
      ['client', this.client],
      ['publisher', this.publisher],
      ['subscriber', this.subscriber],
    ] as const) {
      c.on('error', (err) => this.logger.error({ err }, `Redis ${name} error`));
      c.on('reconnecting', () => this.logger.warn(`Redis ${name} reconnecting`));
    }
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.client.ping(),
      this.publisher.ping(),
      this.subscriber.ping(),
    ]);
    this.logger.log('Redis connected (client + publisher + subscriber)');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.client.quit(), this.publisher.quit(), this.subscriber.quit()]);
  }
}
