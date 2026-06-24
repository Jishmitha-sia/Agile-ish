import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { v7 as uuidV7 } from 'uuid';

import type { AuthenticatedRequest } from '../types/auth.types.js';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Attach a per-request id (UUIDv7 — sortable, time-based) so logs, traces,
 * and error responses can be correlated.
 *
 * Honours an inbound `X-Request-Id` header if present (allows upstream
 * gateways / clients to thread their own correlation id through). Always
 * echoes the id back via the response header so clients can include it
 * in bug reports.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    const incoming = req.header(REQUEST_ID_HEADER);
    const id = isValidRequestId(incoming) ? incoming : uuidV7();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);

    return next.handle();
  }
}

/** Reject obviously malicious or oversized request ids from external callers. */
const isValidRequestId = (raw: string | undefined): raw is string =>
  typeof raw === 'string' && raw.length > 0 && raw.length <= 64 && /^[A-Za-z0-9._-]+$/.test(raw);
