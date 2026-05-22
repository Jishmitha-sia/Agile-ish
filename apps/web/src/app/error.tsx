'use client';

import { useEffect } from 'react';

import { Button } from '../components/ui/button.js';

/**
 * App-router error boundary. Renders when an unhandled error escapes a
 * client component. Tells the user something broke and offers a retry —
 * also logs to the console so the developer-tools panel gets a stack.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app] uncaught error', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t render this page. The error has been logged.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground/70">ref: {error.digest}</p>
        ) : null}
        <Button onClick={() => reset()} className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
