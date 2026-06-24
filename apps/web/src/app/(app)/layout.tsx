'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Spinner } from '../../components/ui/spinner.js';
import { useAuthStore } from '../../stores/auth.store.js';

/**
 * Authenticated route gate.
 *
 * Phase 2 split: this layout is now ONLY responsible for blocking
 * unauthenticated traffic. The visual shell (sidebar, switcher, top bar)
 * lives in `w/[workspaceSlug]/layout.tsx` because it needs a workspace
 * context. Non-workspace routes (create-workspace, account settings)
 * sit on the bare auth-gate and pick their own layout.
 *
 * Two states handled explicitly so we don't flash content:
 *   • status === 'initializing'    → spinner (refresh in flight)
 *   • status === 'unauthenticated' → redirect (middleware also catches
 *                                    this; effect is the SPA fallback)
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="text-muted-foreground size-6" />
      </div>
    );
  }

  return <>{children}</>;
}
