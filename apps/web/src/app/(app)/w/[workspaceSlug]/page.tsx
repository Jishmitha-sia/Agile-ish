'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { TopBar } from '../../../../components/app-shell/top-bar.js';
import { Button } from '../../../../components/ui/button.js';
import { Spinner } from '../../../../components/ui/spinner.js';
import { useProjects } from '../../../../hooks/use-projects.js';
import { useWorkspace } from '../../../../hooks/use-workspaces.js';
import { useAuthStore } from '../../../../stores/auth.store.js';

import type { Project } from '@agile-ish/contracts';

/**
 * Workspace home — projects list + identity card.
 *
 * Phase 2 Batch B replaces the placeholder cards with a real project
 * list driven by the workspace's projects endpoint. Empty state nudges
 * the user toward creating their first project.
 */
export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;

  const { data: workspace, isLoading: wsLoading } = useWorkspace(workspaceSlug);
  const { data: projects, isLoading: projectsLoading } = useProjects(workspaceSlug);
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canCreate = membership ? membership.role === 'OWNER' || membership.role === 'ADMIN' : false;

  return (
    <>
      <TopBar
        title={workspace?.name ?? workspaceSlug}
        description={membership ? `Signed in as ${membership.role.toLowerCase()}` : undefined}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href={`/w/${workspaceSlug}/projects/new`}>
                <Plus /> New project
              </Link>
            </Button>
          ) : null
        }
      />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-5xl space-y-10">
          {wsLoading ? (
            <Spinner className="text-muted-foreground size-5" />
          ) : workspace ? (
            <section className="space-y-2">
              <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
                {workspace.slug}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{workspace.name}</h2>
              {workspace.description ? (
                <p className="text-muted-foreground max-w-prose text-sm">{workspace.description}</p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
                Projects
              </h3>
              {projects?.length ? (
                <span className="text-muted-foreground text-xs">
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                </span>
              ) : null}
            </div>

            {projectsLoading ? (
              <Spinner className="text-muted-foreground size-5" />
            ) : !projects || projects.length === 0 ? (
              <EmptyProjects workspaceSlug={workspaceSlug} canCreate={canCreate} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {projects.map((p) => (
                  <li key={p.id}>
                    <ProjectCard workspaceSlug={workspaceSlug} project={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function ProjectCard({ workspaceSlug, project }: { workspaceSlug: string; project: Project }) {
  return (
    <Link
      href={`/w/${workspaceSlug}/projects/${project.slug}`}
      className="border-border bg-card hover:border-foreground/30 hover:bg-card/70 group block space-y-2 rounded-lg border p-5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <FolderKanban className="text-muted-foreground size-4" />
        <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
          {project.identifierPrefix}
        </span>
      </div>
      <h4 className="text-base font-semibold leading-tight">{project.name}</h4>
      {project.description ? (
        <p className="text-muted-foreground line-clamp-2 text-sm">{project.description}</p>
      ) : (
        <p className="text-muted-foreground/60 text-sm">No description yet.</p>
      )}
    </Link>
  );
}

function EmptyProjects({
  workspaceSlug,
  canCreate,
}: {
  workspaceSlug: string;
  canCreate: boolean;
}) {
  return (
    <div className="border-border bg-card/40 flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <FolderKanban className="size-6" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold">No projects yet</h4>
        <p className="text-muted-foreground max-w-sm text-sm">
          {canCreate
            ? 'Spin up your first project. Boards, sprints, and issues land here.'
            : 'Ask a workspace admin to create the first project.'}
        </p>
      </div>
      {canCreate ? (
        <Button asChild size="sm">
          <Link href={`/w/${workspaceSlug}/projects/new`}>
            <Plus /> Create your first project
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
