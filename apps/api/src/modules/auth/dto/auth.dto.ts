import {
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
  SessionResponse,
  SignupRequest,
} from '@agile-ish/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * NestJS DTO classes wrapping the Zod schemas from @agile-ish/contracts.
 *
 * `createZodDto` produces a class that:
 *   • Validates incoming bodies via nestjs-zod's global ZodValidationPipe.
 *   • Generates OpenAPI schema entries automatically.
 *   • Exposes the inferred TS type via `InstanceType<typeof Dto>`.
 *
 * The Zod schema stays the single source of truth — bumping it (e.g.
 * tightening the password policy) instantly reaches both the API
 * validator and the web form via the contracts package.
 */
export class SignupDto extends createZodDto(SignupRequest) {}
export class LoginDto extends createZodDto(LoginRequest) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordRequest) {}

// Response DTOs — these don't need validation but giving them DTO classes
// lets Swagger render the response shape in /docs.
export class SessionResponseDto extends createZodDto(SessionResponse) {}
export class AuthenticatedUserDto extends createZodDto(AuthenticatedUser) {}
