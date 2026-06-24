import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

import type { AuthenticatedRequest } from '../types/auth.types.js';
import type { ApiErrorCode, ApiErrorResponse } from '@agile-ish/contracts';
import type { Response } from 'express';

/**
 * Maps Prisma's runtime errors into the unified `ApiErrorResponse` envelope.
 *
 * We catch the *concrete* known error classes — never `Error` — so the
 * AllExceptionsFilter handles anything we don't explicitly recognise.
 *
 * Codes we care about (from the Prisma error reference):
 *   P2002 unique constraint violation     → 409 CONFLICT
 *   P2025 record to update/delete missing → 404 NOT_FOUND
 *   P2003 FK constraint violation         → 409 CONFLICT
 *   P2014 invalid relation                → 409 CONFLICT
 *   Other known request errors            → 400 BAD_REQUEST
 *
 * Validation errors (PrismaClientValidationError) shouldn't reach prod —
 * they indicate a programming bug. Map to 500 so they surface in alerts.
 */
@Catch(
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AuthenticatedRequest>();

    const { status, body } = this.toResponse(exception);
    res.status(status).json({
      ...body,
      ...(req.requestId ? { requestId: req.requestId } : {}),
    });
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorResponse } {
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.mapKnownRequest(exception);
    }

    if (exception instanceof PrismaClientValidationError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { code: 'INTERNAL_ERROR', message: 'Database validation error' },
      };
    }

    if (
      exception instanceof PrismaClientInitializationError ||
      exception instanceof PrismaClientRustPanicError ||
      exception instanceof PrismaClientUnknownRequestError
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' },
      };
    }

    // Should be unreachable; defer to higher-level filter.
    throw exception instanceof Error ? exception : new HttpException('Unknown', 500);
  }

  private mapKnownRequest(err: PrismaClientKnownRequestError): {
    status: number;
    body: ApiErrorResponse;
  } {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? 'value';
        return {
          status: HttpStatus.CONFLICT,
          body: this.envelope(
            'CONFLICT',
            `A record with the same ${this.fmtTarget(target)} already exists`,
          ),
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: this.envelope('NOT_FOUND', 'Resource not found'),
        };
      case 'P2003':
      case 'P2014':
        return {
          status: HttpStatus.CONFLICT,
          body: this.envelope('CONFLICT', 'Referenced resource is missing or invalid'),
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: this.envelope('BAD_REQUEST', `Database error (${err.code})`),
        };
    }
  }

  private envelope(code: ApiErrorCode, message: string): ApiErrorResponse {
    return { code, message };
  }

  private fmtTarget(target: string[] | string): string {
    return Array.isArray(target) ? target.join(', ') : target;
  }
}
