'use client';

import { cn } from '@agile-ish/ui';

import { oauthStartUrl, useOAuthProviders } from '../../hooks/use-oauth-providers.js';

import type { OAuthProvider } from '@agile-ish/contracts';


/**
 * Renders the "Continue with Google/GitHub" buttons above the auth form.
 *
 * If the API reports zero enabled providers (env-driven), this component
 * renders nothing — no empty "or continue with" divider, no dead buttons.
 *
 * Each button is a plain anchor — clicking it does a full-page redirect
 * to the API's OAuth start endpoint, which 302s onward to the provider.
 * No JS in the OAuth path means no SPA-state to lose across the round-trip.
 */
export const OAuthButtons = ({ className }: { className?: string }) => {
  const providers = useOAuthProviders();
  const enabled = providers.data ?? [];
  if (enabled.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2">
        {enabled.map((p) => (
          <OAuthButton key={p} provider={p} />
        ))}
      </div>
      <Divider />
    </div>
  );
};

const OAuthButton = ({ provider }: { provider: OAuthProvider }) => {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with GitHub';
  return (
    <a
      href={oauthStartUrl(provider)}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-md border border-input',
        'bg-background px-4 py-2 text-sm font-medium text-foreground',
        'transition-colors hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      )}
    >
      {provider === 'google' ? <GoogleLogo /> : <GitHubLogo />}
      {label}
    </a>
  );
};

const Divider = () => (
  <div className="relative">
    <div className="absolute inset-0 flex items-center" aria-hidden>
      <div className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center">
      <span className="bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
        or
      </span>
    </div>
  </div>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
);

const GitHubLogo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.5 3.18-1.18 3.18-1.18.63 1.58.23 2.75.12 3.04.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14v3.18c0 .31.21.66.79.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);
