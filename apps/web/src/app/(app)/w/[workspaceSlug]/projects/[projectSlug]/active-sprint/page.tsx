'use client';

import { LayoutList } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { TopBar } from '../../../../../../../components/app-shell/top-bar.js';
import { KanbanBoard } from '../../../../../../../components/issues/kanban-board.js';
import { Button } from '../../../../../../../components/ui/button.js';
import { Spinner } from '../../../../../../../components/ui/spinner.js';
import { useProject } from '../../../../../../../hooks/use-projects.js';
import { useActiveSprint } from '../../../../../../../hooks/use-sprints.js';

export default function ActiveSprintPage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;

  const { data: project } = useProject(workspaceSlug, projectSlug);
  const { data: activeSprint, isLoading } = useActiveSprint(workspaceSlug, projectSlug);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={project?.name ?? 'Active Sprint'} description="Active Sprint" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={project?.name ?? 'Active Sprint'} description="Active Sprint" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="bg-muted rounded-full p-6">
            <LayoutList className="text-muted-foreground size-10" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No active sprint</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Start a sprint from the Backlog to see it here.
            </p>
          </div>
          <Link href={`/w/${workspaceSlug}/projects/${projectSlug}/backlog`}>
            <Button variant="outline">Go to Backlog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={project?.name ?? 'Active Sprint'}
        description={`Active Sprint · ${activeSprint.name}`}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-border border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              ACTIVE
            </span>
            <h2 className="font-semibold">{activeSprint.name}</h2>
            {activeSprint.goal && (
              <p className="text-muted-foreground text-sm">· {activeSprint.goal}</p>
            )}
            <span className="text-muted-foreground ml-auto text-sm">
              {activeSprint.issues.length} issue{activeSprint.issues.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <KanbanBoard
          issues={activeSprint.issues}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
        />
      </div>
    </div>
  );
}
