'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

/**
 * QueryClientProvider lives on the client. We import the devtools but
 * Next.js tree-shakes them out of the production bundle because they
 * key off `process.env.NODE_ENV === 'development'` internally.
 */
export const QueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) => (
  <QueryClientProvider client={client}>
    {children}
    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
  </QueryClientProvider>
);
