'use client';

/**
 * Root-level error boundary for App Router. Catches errors thrown above
 * the per-route `error.tsx`. Must render its own <html>/<body> because at
 * this point Next has nothing else to wrap with.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0f1117',
          color: '#f4f5f7',
        }}
      >
        <div style={{ maxWidth: 360, padding: '0 1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#8c93a3', fontSize: 14, margin: '0 0 1.5rem' }}>
            The app encountered an unexpected error.
          </p>
          {error.digest ? (
            <p style={{ color: '#5b6172', fontSize: 12, fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              background: '#7c5cff',
              color: '#fff',
              border: 0,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
