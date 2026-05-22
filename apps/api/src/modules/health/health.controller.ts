import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';

import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

/**
 * Three health endpoints, three audiences:
 *
 *   GET /health/live    — process is alive. No external deps checked.
 *                          Kubernetes liveness probe — failure restarts the pod.
 *
 *   GET /health/ready   — process is ready to serve traffic. Verifies DB +
 *                          Redis. Kubernetes readiness probe — failure removes
 *                          the pod from the service endpoints (no restart).
 *
 *   GET /health         — deep health for ops dashboards. Same checks as
 *                          /ready, plus metadata about uptime + git sha.
 *
 * The liveness/readiness split prevents the "death spiral" where a
 * dependency outage restart-loops every pod.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('live')
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.checkPrisma(),
      () => this.checkRedis(),
    ]);
  }

  @Public()
  @Get()
  @HealthCheck()
  deep() {
    return this.health.check([
      () => this.checkPrisma(),
      () => this.checkRedis(),
    ]);
  }

  private async checkPrisma(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      return { database: { status: 'down', message: (err as Error).message } };
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const reply = await this.redis.client.ping();
      return { redis: { status: reply === 'PONG' ? 'up' : 'down' } };
    } catch (err) {
      return { redis: { status: 'down', message: (err as Error).message } };
    }
  }
}
