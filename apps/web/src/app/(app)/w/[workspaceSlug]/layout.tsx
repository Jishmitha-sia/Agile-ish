'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Sidebar } from '../../../../components/app-shell/sidebar.js';
import { CommandPalette } from '../../../../components/ui/command-palette.js';
import { Spinner } from '../../../../components/ui/spinner.js';
import { useAuthStore } from '../../../../stores/auth.store.js';

/**
 * Workspace-scoped layout — renders the app shell (sidebar + content
 * column) for every route under `/w/[workspaceSlug]/...`.
 *
 * Membership is enforced client-side here (redirect to a workspace the
 * user IS in, or to /workspaces/new) AND server-side by
 * WorkspaceRoleGuard on every API call. The client check is for fast
 * UX feedback; the server check is the actual gate.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const isMember = user?.memberships.some((m) => m.workspaceSlug === workspaceSlug) ?? false;

  useEffect(() => {
    if (!user) return;
    if (isMember) return;
    const fallback = user.memberships[0];
    router.replace(fallback ? `/w/${fallback.workspaceSlug}` : '/workspaces/new');
  }, [user, isMember, router]);

  if (!user || !isMember) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="text-muted-foreground size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar workspaceSlug={workspaceSlug} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette workspaceSlug={workspaceSlug} />
    </div>
  );
}
