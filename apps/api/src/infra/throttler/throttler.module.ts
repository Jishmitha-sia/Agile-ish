import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'throttler-storage-redis';

import { getAppConfig } from '../../config/config.module.js';
import { RedisService } from '../redis/redis.service.js';

/**
 * Redis-backed rate limiting.
 *
 * Two named throttler buckets are registered up-front:
 *   • `global` — applied to every endpoint by default.
 *   • `auth`   — stricter ceiling, attached to /auth endpoints explicitly.
 *
 * Backing the storage with Redis means rate limits work across replicas —
 * a malicious client can't bypass the limit by load-balancing across pods.
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) => {
        const cfg = getAppConfig(config);
        return {
          throttlers: [
            { name: 'global', ttl: cfg.rateLimit.global.ttlSeconds * 1000, limit: cfg.rateLimit.global.max },
            { name: 'auth', ttl: cfg.rateLimit.auth.ttlSeconds * 1000, limit: cfg.rateLimit.auth.max },
          ],
          storage: new ThrottlerStorageRedisService(redis.client),
        };
      },
    }),
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
