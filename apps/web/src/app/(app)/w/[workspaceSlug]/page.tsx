'use client';

import { useParams } from 'next/navigation';

import { TopBar } from '../../../../components/app-shell/top-bar.js';
import { Spinner } from '../../../../components/ui/spinner.js';
import { useWorkspace } from '../../../../hooks/use-workspaces.js';
import { useAuthStore } from '../../../../stores/auth.store.js';

/**
 * Workspace home — the page you land on after picking a workspace.
 *
 * Phase 2 Batch A: shows the workspace identity (name, slug,
 * description, your role) and placeholders for what's coming. Batches
 * B/C/D fill in projects, members, and the command palette.
 */
export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;

  const { data: workspace, isLoading } = useWorkspace(workspaceSlug);
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);

  return (
    <>
      <TopBar
        title={workspace?.name ?? workspaceSlug}
        description={membership ? `Signed in as ${membership.role.toLowerCase()}` : undefined}
      />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {isLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : workspace ? (
            <section className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {workspace.slug}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{workspace.name}</h2>
              {workspace.description ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  {workspace.description}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <PlaceholderCard
              title="Projects"
              body="Project boards, sprints, and issues land in Batch B. You'll create your first project from here."
            />
            <PlaceholderCard
              title="Members"
              body="Invite teammates by email and manage roles. Coming next in Batch C — invitation tokens included."
            />
          </section>
        </div>
      </main>
    </>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-card/40 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
