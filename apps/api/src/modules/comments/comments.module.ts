import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infra/prisma/prisma.module.js';

import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
