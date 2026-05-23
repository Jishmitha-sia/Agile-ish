import {
  ConfirmPasswordResetRequest,
  RequestPasswordResetRequest,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class RequestPasswordResetDto extends createZodDto(RequestPasswordResetRequest) {}
export class ConfirmPasswordResetDto extends createZodDto(ConfirmPasswordResetRequest) {}
