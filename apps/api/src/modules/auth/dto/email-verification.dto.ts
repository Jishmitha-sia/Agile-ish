import {
  ConfirmEmailVerificationRequest,
  RequestEmailVerificationRequest,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

export class RequestEmailVerificationDto extends createZodDto(RequestEmailVerificationRequest) {}
export class ConfirmEmailVerificationDto extends createZodDto(ConfirmEmailVerificationRequest) {}
