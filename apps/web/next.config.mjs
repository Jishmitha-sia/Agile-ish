// @ts-check

/**
 * Next.js configuration.
 *
 * - `transpilePackages` lets us consume @agile-ish/contracts and @agile-ish/ui
 *   as workspace TS sources without a separate build step in dev.
 * - `output: 'standalone'` produces a minimal-deps server bundle for the
 *   Docker image (Batch 5) so the production container stays small.
 * - `experimental.typedRoutes` makes <Link href="..."> route-typed.
 * - Security headers: a baseline CSP-light. The full CSP lands in Phase 7
 *   when we know the deploy origin; for now we set the non-CSP headers and
 *   leave CSP to be done at the reverse-proxy layer (Caddy) in production.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@agile-ish/contracts', '@agile-ish/ui'],

  experimental: {
    typedRoutes: true,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
