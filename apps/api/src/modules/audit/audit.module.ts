import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service.js';
import { AuditSubscriber } from './audit.subscriber.js';

/**
 * Audit module — global so any service can inject `AuditService` directly,
 * and the subscriber registers itself on app bootstrap regardless of
 * import order.
 */
@Global()
@Module({
  providers: [AuditService, AuditSubscriber],
  exports: [AuditService],
})
export class AuditModule {}
