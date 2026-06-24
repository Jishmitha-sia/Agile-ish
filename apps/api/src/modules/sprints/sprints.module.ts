import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { ProjectsModule } from '../projects/projects.module.js';

import { SprintsController } from './sprints.controller.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [PrismaModule, ProjectsModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
