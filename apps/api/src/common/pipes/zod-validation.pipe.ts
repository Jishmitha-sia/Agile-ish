import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

/**
 * NestJS pipe that runs an incoming value through a Zod schema.
 * On failure, throws a BadRequestException whose payload is the same
 * `ApiErrorResponse` envelope used everywhere — `code`, `message`, `issues[]`.
 *
 * Usage:
 *   @Body(new ZodValidationPipe(LoginRequest)) body: LoginRequest
 *
 * For full-controller validation we prefer attaching schemas via
 * `nestjs-zod`'s `@ZodDto` for OpenAPI integration; this pipe is the
 * lower-level primitive that powers it and is exposed for ad-hoc use
 * (e.g. validating query parameters with a one-off schema).
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
        issues: serialiseZodIssues(result.error),
      });
    }
    return result.data;
  }
}

const serialiseZodIssues = (error: ZodError): { path: (string | number)[]; message: string; code: string }[] =>
  error.issues.map((issue) => ({
    path: [...issue.path],
    message: issue.message,
    code: issue.code,
  }));
