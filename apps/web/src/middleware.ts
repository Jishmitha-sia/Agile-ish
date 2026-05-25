import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware.
 *
 * Coarse-grained UX gating based on the *presence* of the refresh cookie.
 * The real auth check still happens server-side at the API — middleware
 * just keeps users from briefly seeing a login page when they're already
 * signed in, and vice versa.
 *
 *   • /login, /signup with cookie         → redirect to /
 *   • / (or any protected route) no cookie → redirect to /login?next=…
 *
 * Cookie name is sourced from NEXT_PUBLIC_REFRESH_COOKIE_NAME so the API
 * and middleware always agree. Edge runtime can read NEXT_PUBLIC_* env at
 * build time without polyfills.
 */
const REFRESH_COOKIE = process.env.NEXT_PUBLIC_REFRESH_COOKIE_NAME ?? 'agile_rt';

// Public routes that don't require a session. The first two are the
// signup/login forms — already-logged-in users get bounced to `/`. The
// reset / verify routes are reached via email links and must work for
// logged-out users without a redirect bounce.
const AUTH_ROUTES = ['/login', '/signup'];
const PUBLIC_ROUTES = ['/forgot-password', '/reset-password', '/verify-email', '/invite'];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasRefresh = req.cookies.has(REFRESH_COOKIE);
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicRoute = PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Already-signed-in users on /login or /signup bounce to the app shell.
  // We deliberately DON'T bounce them off /reset-password or /verify-email
  // — they may legitimately need those flows even while logged in.
  if (isAuthRoute && hasRefresh) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Anything that isn't an auth/public route requires a refresh cookie.
  if (!isAuthRoute && !isPublicRoute && !hasRefresh) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Match every route EXCEPT:
 *   • Next.js internals (_next/static, _next/image)
 *   • Static assets (anything with a file extension)
 *   • favicon
 *
 * The exclusion list keeps middleware off the hot path for asset requests.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
