import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Global so feature modules can inject `PrismaService` without re-importing.
 * The service holds a long-lived connection pool — there's exactly one
 * instance per process.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
