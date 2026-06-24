import { createZodDto } from 'nestjs-zod';
import { CreateCommentRequest, UpdateCommentRequest } from '@agile-ish/contracts';

export class CreateCommentDto extends createZodDto(CreateCommentRequest) {}
export class UpdateCommentDto extends createZodDto(UpdateCommentRequest) {}
