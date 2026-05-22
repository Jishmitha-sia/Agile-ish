import { UpdateProfileRequest, UserPrivateProfile, UserPublicProfile } from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProfileDto extends createZodDto(UpdateProfileRequest) {}
export class UserPrivateProfileDto extends createZodDto(UserPrivateProfile) {}
export class UserPublicProfileDto extends createZodDto(UserPublicProfile) {}
