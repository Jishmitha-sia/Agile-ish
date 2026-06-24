'use client';

import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type { SearchResponse } from '@agile-ish/contracts';

export const useSearch = (workspaceSlug: string | undefined, rawQuery: string) => {
  const [query] = useDebounce(rawQuery, 250);
  const status = useAuthStore((s) => s.status);

  return useQuery({
    queryKey: ['search', workspaceSlug, query],
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && query.trim().length >= 1,
    queryFn: async (): Promise<SearchResponse> => {
      const api = getApiClient();
      const res = await api.get(
        `/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(query)}`,
      );
      return res as SearchResponse;
    },
    staleTime: 10_000,
  });
};
