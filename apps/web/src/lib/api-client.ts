import { clientEnv } from '../env.js';

import { toApiError } from './api-error.js';

import type { SessionResponse } from '@agile-ish/contracts';

/**
 * Fetch wrapper with automatic refresh-token rotation.
 *
 * Lifecycle for a request that needs auth:
 *
 *     1. Send with the current in-memory access token (if any).
 *     2. If response is 401 AND we're not already calling /auth/refresh:
 *        a. Trigger /auth/refresh (deduped — concurrent 401s share one
 *           in-flight refresh promise).
 *        b. If refresh succeeds, retry the original request once.
 *        c. If refresh fails, clear local auth state and let the 401
 *           propagate to the caller.
 *
 * Why this lives in a class:
 *   • The dedupe state (`refreshInFlight`) needs to be shared across
 *     every concurrent request — a global flag would be a race.
 *   • Callbacks (`onRefreshed`, `onUnauthenticated`) are injected so the
 *     client doesn't have to know about Zustand or React. That keeps it
 *     testable in plain JS.
 *
 * The client is instantiated once in `providers/root-provider.tsx` and
 * wired to the auth store + a single toast queue.
 */

export interface ApiClientHooks {
  getAccessToken: () => string | null;
  onRefreshed: (session: SessionResponse) => void;
  onUnauthenticated: () => void;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set to true to skip the 401 → refresh dance (auth endpoints themselves). */
  skipAuthRefresh?: boolean;
}

const AUTH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout']);

export class ApiClient {
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly hooks: ApiClientHooks,
  ) {}

  // ─── Convenience verbs ─────────────────────────────────────────────────

  get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.json<T>(path, { ...opts, method: 'GET' });
  }
  post<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.json<T>(path, { ...opts, method: 'POST', body });
  }
  patch<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.json<T>(path, { ...opts, method: 'PATCH', body });
  }
  delete<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.json<T>(path, { ...opts, method: 'DELETE' });
  }

  // ─── Core ──────────────────────────────────────────────────────────────

  private async json<T>(path: string, opts: RequestOptions): Promise<T> {
    const res = await this.fetch(path, opts);
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as T;
  }

  private async fetch(path: string, opts: RequestOptions): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const skipRefresh = (opts.skipAuthRefresh ?? false) || AUTH_PATHS.has(path);
    const exec = (): Promise<Response> => this.rawFetch(url, opts);

    const res = await exec();
    if (res.status !== 401 || skipRefresh) return res;

    const refreshed = await this.ensureRefreshed();
    if (!refreshed) return res; // surface the 401 unchanged

    return await exec();
  }

  private async rawFetch(url: string, opts: RequestOptions): Promise<Response> {
    const token = this.hooks.getAccessToken();
    const headers = new Headers(opts.headers);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const hasBody = opts.body !== undefined && opts.body !== null;
    if (hasBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return await fetch(url, {
      ...opts,
      headers,
      credentials: 'include', // carries the refresh cookie cross-request
      body: hasBody ? JSON.stringify(opts.body) : null,
    });
  }

  /**
   * Refresh, deduplicating concurrent calls. Returns true on success
   * (caller should retry the original request) and false on failure
   * (caller should let the 401 propagate).
   */
  private async ensureRefreshed(): Promise<boolean> {
    if (this.refreshInFlight) return await this.refreshInFlight;

    this.refreshInFlight = (async (): Promise<boolean> => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          this.hooks.onUnauthenticated();
          return false;
        }
        const data = (await res.json()) as SessionResponse;
        this.hooks.onRefreshed(data);
        return true;
      } catch {
        this.hooks.onUnauthenticated();
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return await this.refreshInFlight;
  }
}

/**
 * Build a singleton ApiClient. Called once during provider setup —
 * subsequent calls return the same instance to keep the dedupe state
 * meaningful across the whole app.
 */
let singleton: ApiClient | null = null;
export const createApiClient = (hooks: ApiClientHooks): ApiClient => {
  if (singleton) return singleton;
  singleton = new ApiClient(clientEnv.NEXT_PUBLIC_API_BASE_URL, hooks);
  return singleton;
};

export const getApiClient = (): ApiClient => {
  if (!singleton) {
    throw new Error('ApiClient not initialised — wrap your tree in <RootProvider>.');
  }
  return singleton;
};
