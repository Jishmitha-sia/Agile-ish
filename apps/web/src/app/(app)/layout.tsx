'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button.js';
import { Spinner } from '../../components/ui/spinner.js';
import { useLogout } from '../../hooks/use-auth.js';
import { useAuthStore } from '../../stores/auth.store.js';

/**
 * Authenticated shell. Phase 1 renders a header with the current user
 * and a logout button. Phase 2 adds the sidebar + workspace switcher.
 *
 * The shell handles two states explicitly so we don't flash content:
 *   • status === 'initializing'  → spinner
 *   • status === 'unauthenticated' → redirect (middleware also catches
 *                                    this; the effect is the fallback for
 *                                    SPA navigation after a refresh fails)
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-foreground/70">agile-ish</span>
          {user?.memberships[0] ? (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{user.memberships[0].workspaceSlug}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await logout.mutateAsync();
                router.replace('/login');
              } catch {
                toast.error('Logout failed — please try again');
              }
            }}
          >
            <LogOut /> Log out
          </Button>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
