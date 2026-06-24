import { CreateCommentRequest, UpdateCommentRequest } from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateCommentDto extends createZodDto(CreateCommentRequest) {}
export class UpdateCommentDto extends createZodDto(UpdateCommentRequest) {}
