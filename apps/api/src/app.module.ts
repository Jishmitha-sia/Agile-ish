import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor.js';
import { ConfigModule } from './config/config.module.js';
import { BullMQModule } from './infra/bullmq/bullmq.module.js';
import { EventsModule } from './infra/events/events.module.js';
import { LoggerModule } from './infra/logger/logger.module.js';
import { MailerModule } from './infra/mailer/mailer.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { ThrottlerModule } from './infra/throttler/throttler.module.js';
import { HealthModule } from './modules/health/health.module.js';

/**
 * Composition root.
 *
 * Module ordering follows the dependency cone:
 *   1. ConfigModule + LoggerModule — must boot first, everything else
 *      depends on them.
 *   2. Infra modules (Prisma, Redis, BullMQ, Events, Mailer, Throttler) —
 *      cross-cutting capabilities. All global so feature modules don't
 *      have to re-import them.
 *   3. Feature modules (Phase 1: Health only; Phase 3 adds Auth, Users,
 *      Workspaces; later phases append more).
 *
 * Filters are registered globally via `APP_FILTER` so every controller
 * gets unified error responses. PrismaExceptionFilter must be listed
 * BEFORE AllExceptionsFilter — Nest applies filters in reverse order, so
 * the most specific (Prisma) gets last shot at catching errors before
 * the catch-all swallows them.
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    BullMQModule,
    EventsModule,
    MailerModule,
    ThrottlerModule,
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
  ],
})
export class AppModule {}
