import { Global, Module } from '@nestjs/common';

import { EventBus } from './event-bus.service.js';

@Global()
@Module({
  providers: [EventBus],
  exports: [EventBus],
})
export class EventsModule {}

export { EventBus } from './event-bus.service.js';
export { DomainEvent, type SerialisedDomainEvent } from './domain-event.base.js';
