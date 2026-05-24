import {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateProjectDto extends createZodDto(CreateProjectRequest) {}
export class UpdateProjectDto extends createZodDto(UpdateProjectRequest) {}
export class ProjectResponseDto extends createZodDto(Project) {}
