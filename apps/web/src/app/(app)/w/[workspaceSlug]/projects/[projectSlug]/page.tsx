'use client';

import { ListTodo, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { TopBar } from '../../../../../../components/app-shell/top-bar.js';
import { Button } from '../../../../../../components/ui/button.js';
import { Spinner } from '../../../../../../components/ui/spinner.js';
import { useProject } from '../../../../../../hooks/use-projects.js';

/**
 * Project home — the page you land on when you click a project from the
 * workspace home or the sidebar.
 *
 * Phase 2 Batch B: shows the project identity (prefix, name, description)
 * and a roadmap-marker for issues. Phase 3 replaces this with the issues
 * board (DnD Kit columns, sprint header, filters).
 */
export default function ProjectHomePage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;
  const { data: project, isLoading } = useProject(workspaceSlug, projectSlug);

  return (
    <>
      <TopBar
        title={project?.name ?? projectSlug}
        description={
          project ? `${project.identifierPrefix} · ${project.issueCounter} issues` : undefined
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${workspaceSlug}/projects/${projectSlug}/settings`}>
              <Settings /> Settings
            </Link>
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {isLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : project ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-primary">
                  {project.identifierPrefix}
                </span>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {project.slug}
                </p>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
              {project.description ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  {project.description}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListTodo className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Issues board coming in Phase 3</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Drag-and-drop columns, sprints, optimistic mutations, and the{' '}
                <span className="font-mono">{project?.identifierPrefix ?? 'XXX'}-1</span>{' '}
                identifier scheme all land in the next phase.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
