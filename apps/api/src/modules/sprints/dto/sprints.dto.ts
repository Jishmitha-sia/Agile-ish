import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CreateSprintRequest, UpdateSprintRequest } from '@agile-ish/contracts';

export class CreateSprintDto extends createZodDto(CreateSprintRequest) {}
export class UpdateSprintDto extends createZodDto(UpdateSprintRequest) {}

export const ListSprintsQuery = z.object({
  includeCompleted: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .default('false'),
});
export class ListSprintsQueryDto extends createZodDto(ListSprintsQuery) {}
