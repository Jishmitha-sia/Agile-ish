import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';

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
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IssuesModule } from './modules/issues/issues.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SprintsModule } from './modules/sprints/sprints.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

/**
 * Composition root.
 *
 * Module ordering follows the dependency cone:
 *   1. ConfigModule + LoggerModule — must boot first.
 *   2. Infra modules (Prisma/Redis/BullMQ/Events/Mailer/Throttler) — global.
 *   3. Audit module — global, listens to events at bootstrap.
 *   4. Feature modules (Auth, Users, Workspaces, Health).
 *
 * Global providers:
 *   • JwtAuthGuard      — default-deny auth on every endpoint; opt out
 *                          per-handler with `@Public()`.
 *   • ThrottlerGuard    — applies the 'global' bucket to every endpoint;
 *                          per-handler `@Throttle()` overrides.
 *   • AllExceptionsFilter / PrismaExceptionFilter — unified error envelope.
 *   • RequestIdInterceptor — UUIDv7 correlation id per request.
 *
 * Filter order matters: Nest evaluates `APP_FILTER` providers in REVERSE
 * registration order. PrismaExceptionFilter is registered second so it
 * runs before the catch-all and gets first chance at mapping Prisma errors.
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
    AuditModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    IssuesModule,
    SprintsModule,
    CommentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
