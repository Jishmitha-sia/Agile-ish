'use client';

import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { createQueryClient } from '../lib/query-client.js';

import { AuthBootstrap } from './auth-bootstrap.js';
import { QueryProvider } from './query-provider.js';
import { ThemeProvider } from './theme-provider.js';

/**
 * Composition root for all client-side providers.
 *
 * Order matters:
 *   1. ThemeProvider (outermost) — every child can read the theme.
 *   2. QueryProvider — children can call useQuery/useMutation.
 *   3. AuthBootstrap — kicks off /auth/refresh and wires the api client.
 *   4. Toaster — sibling to children so it can render over them.
 *
 * The QueryClient is stable across re-renders via useState — passing a
 * fresh client on each render would blow away the cache.
 */
export const RootProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ThemeProvider>
      <QueryProvider client={queryClient}>
        <AuthBootstrap>
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </AuthBootstrap>
      </QueryProvider>
    </ThemeProvider>
  );
};
