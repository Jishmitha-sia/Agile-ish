import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ZodError } from 'zod';

import type { AuthenticatedRequest } from '../types/auth.types.js';
import type { ApiErrorCode, ApiErrorResponse } from '@agile-ish/contracts';
import type { Response } from 'express';

/**
 * Global catch-all filter. Every non-2xx response goes through here and
 * comes out in the unified `ApiErrorResponse` envelope. We do this once,
 * here, instead of per-controller — every endpoint gets consistent error
 * shape for free.
 *
 * Three classes of error get special handling:
 *   1. NestJS HttpException — already structured; we just normalise the body.
 *   2. ZodError (e.g. thrown by a service-layer validation) — map to 422
 *      with field-level issues.
 *   3. Prisma errors — handled by a separate, more specific filter so
 *      we don't have to know about Prisma here. They flow through to us
 *      as InternalServerError if that filter declined them.
 *
 * Stack traces are NEVER returned to clients in production. They're logged
 * server-side with the requestId so we can correlate.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AuthenticatedRequest>();

    const { status, body } = this.toResponse(exception, req.requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId: req.requestId, userId: req.user?.id, path: req.url, status, err: exception },
        'Unhandled exception',
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        { requestId: req.requestId, userId: req.user?.id, path: req.url, status, code: body.code },
        body.message,
      );
    }

    res.status(status).json(body);
  }

  private toResponse(
    exception: unknown,
    requestId: string | undefined,
  ): { status: number; body: ApiErrorResponse } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body =
        typeof raw === 'object' && raw !== null
          ? this.normaliseHttpExceptionBody(raw as Record<string, unknown>, status)
          : { code: this.codeForStatus(status), message: String(raw) };
      return {
        status,
        body: { ...body, ...(requestId ? { requestId } : {}) },
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          code: 'UNPROCESSABLE_ENTITY',
          message: 'Validation failed',
          issues: exception.issues.map((i) => ({
            path: [...i.path],
            message: i.message,
            code: i.code,
          })),
          ...(requestId ? { requestId } : {}),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        ...(requestId ? { requestId } : {}),
      },
    };
  }

  private normaliseHttpExceptionBody(
    raw: Record<string, unknown>,
    status: number,
  ): { code: ApiErrorCode; message: string; issues?: ApiErrorResponse['issues'] } {
    const code = (raw.code as ApiErrorCode | undefined) ?? this.codeForStatus(status);
    const message =
      (raw.message as string | string[] | undefined) instanceof Array
        ? (raw.message as string[]).join('; ')
        : ((raw.message as string | undefined) ?? this.defaultMessage(status));
    const issues = raw.issues as ApiErrorResponse['issues'];
    return issues ? { code, message: String(message), issues } : { code, message: String(message) };
  }

  private codeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private defaultMessage(status: number): string {
    return HttpStatus[status]?.toString() ?? 'Unknown error';
  }
}
