import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Cluster, Redis } from 'ioredis';

import { getAppConfig } from '../../config/config.module.js';

/**
 * BullMQ root module — registers a default queue connection used by every
 * `BullModule.registerQueue(...)` call in feature modules.
 *
 * Connection settings differ from the general-purpose Redis client because
 * BullMQ requires `maxRetriesPerRequest: null` (long-poll blocking command).
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = getAppConfig(config);
        // Returning a `connection` config (not a Redis instance) lets BullMQ
        // own its own client lifecycle. Mixing connection objects with
        // shared Redis instances has subtle pub/sub interaction bugs.
        return {
          connection: new Redis(cfg.redis.url, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          }) satisfies Redis | Cluster,
          prefix: `${cfg.redis.namespace}:bull`,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 24 * 3600, count: 1000 },
            removeOnFail: { age: 7 * 24 * 3600 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class BullMQModule {}
