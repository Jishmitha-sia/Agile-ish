'use client';

import { Users } from 'lucide-react';
import { useParams } from 'next/navigation';

import { TopBar } from '../../../../../components/app-shell/top-bar.js';
import { useWorkspace } from '../../../../../hooks/use-workspaces.js';

/**
 * Members page — stub for Batch A. Batch C will replace this with the
 * real list (invite by email, role management, invitation tokens for
 * not-yet-registered users, transfer-ownership flow).
 *
 * The stub exists so the sidebar link doesn't 404; it also doubles as
 * a visible roadmap marker.
 */
export default function MembersPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const { data: workspace } = useWorkspace(params.workspaceSlug);

  return (
    <>
      <TopBar title="Members" description={workspace?.name ?? params.workspaceSlug} />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Members are coming in Batch C</h2>
            <p className="text-sm text-muted-foreground">
              Invite teammates by email, manage roles, and send invitation tokens to
              users who don&apos;t have an account yet.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
