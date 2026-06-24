import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

import { UpdateProfileDto, UserPrivateProfileDto } from './dto/users.dto.js';
import { UsersService } from './users.service.js';

import type { RequestUser } from '../../common/types/auth.types.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile + memberships' })
  async me(@CurrentUser() user: RequestUser): Promise<UserPrivateProfileDto> {
    return await this.users.getPrivateProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() patch: UpdateProfileDto,
  ): Promise<UserPrivateProfileDto> {
    return await this.users.updateProfile(user.id, patch);
  }

  @Get('me/memberships')
  @ApiOperation({ summary: 'List workspace memberships for the current user' })
  async memberships(@CurrentUser() user: RequestUser) {
    return await this.users.listMemberships(user.id);
  }
}
