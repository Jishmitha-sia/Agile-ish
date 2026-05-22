import {
  ChangeMemberRoleRequest,
  CreateWorkspaceRequest,
  InviteMemberRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceMember,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceRequest) {}
export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceRequest) {}
export class InviteMemberDto extends createZodDto(InviteMemberRequest) {}
export class ChangeMemberRoleDto extends createZodDto(ChangeMemberRoleRequest) {}

export class WorkspaceResponseDto extends createZodDto(Workspace) {}
export class WorkspaceMemberResponseDto extends createZodDto(WorkspaceMember) {}
