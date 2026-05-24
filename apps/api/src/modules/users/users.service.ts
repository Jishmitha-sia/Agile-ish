import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

import type {
  UpdateProfileRequest,
  UserId,
  UserPrivateProfile,
  WorkspaceMembership,
} from '@agile-ish/contracts';


@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrivateProfile(userId: UserId): Promise<UserPrivateProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    return {
      id: user.id as UserId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: UserId, patch: UpdateProfileRequest): Promise<UserPrivateProfile> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      },
    });
    return await this.getPrivateProfile(userId);
  }

  async listMemberships(userId: UserId): Promise<WorkspaceMembership[]> {
    const rows = await this.prisma.workspaceMember.findMany({
      // Soft-deleted workspaces stay in workspace_members for restoration
      // tooling but must not surface in user-facing membership lists.
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: { select: { id: true, slug: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      workspaceId: m.workspaceId as WorkspaceMembership['workspaceId'],
      workspaceSlug: m.workspace.slug,
      workspaceName: m.workspace.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }
}
