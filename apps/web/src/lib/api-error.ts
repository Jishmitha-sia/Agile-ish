import { ApiErrorResponse } from '@agile-ish/contracts';

/**
 * Strongly-typed error thrown by the api client on non-2xx responses.
 * Carries the parsed `ApiErrorResponse` envelope so UI can render
 * field-level issues (422) and friendly messages (4xx).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorResponse;

  constructor(status: number, body: ApiErrorResponse) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get code(): ApiErrorResponse['code'] {
    return this.body.code;
  }

  get fieldIssues(): ApiErrorResponse['issues'] {
    return this.body.issues;
  }
}

/** Best-effort parse of a fetch Response into an ApiError. */
export const toApiError = async (res: Response): Promise<ApiError> => {
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = { code: 'INTERNAL_ERROR', message: res.statusText || 'Request failed' };
  }

  const result = ApiErrorResponse.safeParse(parsed);
  if (result.success) {
    return new ApiError(res.status, result.data);
  }

  // Server returned something that doesn't match our envelope — fall back
  // to a synthetic error so the UI still gets a usable message.
  return new ApiError(res.status, {
    code: 'INTERNAL_ERROR',
    message: typeof parsed === 'object' && parsed && 'message' in parsed
      ? String((parsed).message)
      : `HTTP ${res.status}`,
  });
};
