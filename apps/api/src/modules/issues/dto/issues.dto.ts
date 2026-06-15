import {
  CreateIssueRequest,
  Issue,
  ListIssuesQuery,
  UpdateIssueRequest,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateIssueDto extends createZodDto(CreateIssueRequest) {}
export class UpdateIssueDto extends createZodDto(UpdateIssueRequest) {}
export class ListIssuesQueryDto extends createZodDto(ListIssuesQuery) {}
export class IssueResponseDto extends createZodDto(Issue) {}
