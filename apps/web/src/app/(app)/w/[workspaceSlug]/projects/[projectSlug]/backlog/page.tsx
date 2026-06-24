'use client';

import { type Issue, type Sprint, ISSUE_STATUS_ORDER } from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import {
  ChevronDown,
  ChevronRight,
  Flag,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { TopBar } from '../../../../../../../components/app-shell/top-bar.js';
import {
  StatusIcon,
  statusLabel,
  PriorityBadge,
} from '../../../../../../../components/issues/issue-presentation.js';
import { Button } from '../../../../../../../components/ui/button.js';
import { Spinner } from '../../../../../../../components/ui/spinner.js';
import { useIssues, useUpdateIssue } from '../../../../../../../hooks/use-issues.js';
import { useProject } from '../../../../../../../hooks/use-projects.js';
import {
  useSprints,
  useCreateSprint,
  useUpdateSprint,
  useDeleteSprint,
} from '../../../../../../../hooks/use-sprints.js';

export default function BacklogPage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;

  const { data: project } = useProject(workspaceSlug, projectSlug);
  const { data: issues = [], isLoading: issuesLoading } = useIssues(workspaceSlug, projectSlug);
  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(
    workspaceSlug,
    projectSlug,
    true,
  );

  const createSprint = useCreateSprint(workspaceSlug, projectSlug);
  const updateSprint = useUpdateSprint(workspaceSlug, projectSlug);
  const deleteSprint = useDeleteSprint(workspaceSlug, projectSlug);

  const [creating, setCreating] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());

  const backlogIssues = issues.filter((i) => !i.sprintId);
  const isLoading = issuesLoading || sprintsLoading;

  const toggleSprint = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSprint = async () => {
    if (!newSprintName.trim()) return;
    await toast.promise(createSprint.mutateAsync({ name: newSprintName.trim() }), {
      loading: 'Creating sprint…',
      success: 'Sprint created!',
      error: 'Failed to create sprint',
    });
    setNewSprintName('');
    setCreating(false);
  };

  const handleStartSprint = async (sprint: Sprint) => {
    await toast.promise(
      updateSprint.mutateAsync({ sprintId: sprint.id, patch: { status: 'ACTIVE' } }),
      {
        loading: 'Starting sprint…',
        success: 'Sprint started!',
        error: 'Another sprint may already be active',
      },
    );
  };

  const handleCompleteSprint = async (sprint: Sprint) => {
    await toast.promise(
      updateSprint.mutateAsync({ sprintId: sprint.id, patch: { status: 'COMPLETED' } }),
      {
        loading: 'Completing sprint…',
        success: 'Sprint completed!',
        error: 'Failed to complete sprint',
      },
    );
  };

  const handleDeleteSprint = async (sprintId: string) => {
    await toast.promise(deleteSprint.mutateAsync(sprintId), {
      loading: 'Deleting sprint…',
      success: 'Sprint deleted',
      error: 'Failed',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={project?.name ?? 'Backlog'} description="Backlog" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={project?.name ?? 'Backlog'} description="Backlog" />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {/* Sprints */}
        {sprints.map((sprint) => {
          const sprintIssues = issues.filter((i) => i.sprintId === sprint.id);
          const isExpanded = expandedSprints.has(sprint.id);
          return (
            <div key={sprint.id} className="border-border bg-card rounded-lg border">
              {/* Sprint header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleSprint(sprint.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-medium">{sprint.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      sprint.status === 'ACTIVE'
                        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                        : sprint.status === 'COMPLETED'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    )}
                  >
                    {sprint.status}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {sprintIssues.length} issue{sprintIssues.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sprint.status === 'PLANNED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleStartSprint(sprint)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Play className="size-3" />
                      Start Sprint
                    </Button>
                  )}
                  {sprint.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCompleteSprint(sprint)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <CheckCircle2 className="size-3" />
                      Complete Sprint
                    </Button>
                  )}
                  <button
                    onClick={() => void handleDeleteSprint(sprint.id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors"
                    title="Delete sprint"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Sprint issues */}
              {isExpanded && (
                <div className="border-border border-t">
                  {sprintIssues.length === 0 ? (
                    <p className="text-muted-foreground px-10 py-3 text-sm">
                      No issues in this sprint. Add issues from the backlog below.
                    </p>
                  ) : (
                    <IssueTable
                      issues={sprintIssues}
                      workspaceSlug={workspaceSlug}
                      projectSlug={projectSlug}
                      showMoveToBacklog
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Create sprint button */}
        {creating ? (
          <div className="border-border bg-card flex items-center gap-2 rounded-lg border p-3">
            <input
              autoFocus
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateSprint();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="Sprint name…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <Button
              size="sm"
              onClick={() => void handleCreateSprint()}
              disabled={!newSprintName.trim()}
            >
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="border-border text-muted-foreground hover:border-primary/40 hover:text-foreground flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors"
          >
            <Plus className="size-4" />
            Create Sprint
          </button>
        )}

        {/* Raw backlog */}
        <div className="border-border bg-card rounded-lg border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Flag className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Backlog</span>
            <span className="text-muted-foreground text-xs">{backlogIssues.length} issues</span>
          </div>
          <div className="border-border border-t">
            {backlogIssues.length === 0 ? (
              <p className="text-muted-foreground px-10 py-3 text-sm">
                All issues are in a sprint. 🎉
              </p>
            ) : (
              <IssueTable
                issues={backlogIssues}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
                sprints={sprints.filter((s) => s.status !== 'COMPLETED')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Issue table ──────────────────────────────────────────────────────────────

function IssueTable({
  issues,
  workspaceSlug,
  projectSlug,
  sprints,
  showMoveToBacklog,
}: {
  issues: Issue[];
  workspaceSlug: string;
  projectSlug: string;
  sprints?: Sprint[];
  showMoveToBacklog?: boolean;
}) {
  const sorted = [...issues].sort(
    (a, b) => ISSUE_STATUS_ORDER.indexOf(a.status) - ISSUE_STATUS_ORDER.indexOf(b.status),
  );

  return (
    <ul className="divide-border divide-y">
      {sorted.map((issue) => (
        <IssueRow
          key={issue.id}
          issue={issue}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
          {...(sprints !== undefined ? { sprints } : {})}
          {...(showMoveToBacklog !== undefined ? { showMoveToBacklog } : {})}
        />
      ))}
    </ul>
  );
}

function IssueRow({
  issue,
  workspaceSlug,
  projectSlug,
  sprints,
  showMoveToBacklog,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
  sprints?: Sprint[];
  showMoveToBacklog?: boolean;
}) {
  const update = useUpdateIssue(workspaceSlug, projectSlug, issue.number);

  const moveToBacklog = () => {
    void update.mutateAsync({ sprintId: null });
  };

  return (
    <li className="hover:bg-muted/30 flex items-center gap-3 px-4 py-2.5 transition-colors">
      <StatusIcon status={issue.status} className="size-4 shrink-0" />
      <Link
        href={`/w/${workspaceSlug}/projects/${projectSlug}/issues/${issue.number}`}
        className="text-muted-foreground hover:text-primary shrink-0 font-mono text-xs"
      >
        {issue.identifier}
      </Link>
      <Link
        href={`/w/${workspaceSlug}/projects/${projectSlug}/issues/${issue.number}`}
        className="hover:text-primary flex-1 truncate text-sm"
      >
        {issue.title}
      </Link>
      <span className="text-xs text-muted-foreground">{statusLabel(issue.status)}</span>
      <PriorityBadge priority={issue.priority} />

      {sprints && sprints.length > 0 && (
        <SprintAssignDropdown
          issue={issue}
          sprints={sprints}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
        />
      )}
      {showMoveToBacklog && (
        <button
          onClick={moveToBacklog}
          disabled={update.isPending}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
        >
          → Backlog
        </button>
      )}
    </li>
  );
}

function SprintAssignDropdown({
  issue,
  sprints,
  workspaceSlug,
  projectSlug,
}: {
  issue: Issue;
  sprints: Sprint[];
  workspaceSlug: string;
  projectSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateIssue(workspaceSlug, projectSlug, issue.number);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
      >
        <Plus className="size-3" />
        Sprint
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="border-border bg-popover absolute right-0 z-20 mt-1 min-w-[140px] rounded-md border shadow-md">
            {sprints.map((s) => (
              <button
                key={s.id}
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                onClick={() => {
                  void update.mutateAsync({ sprintId: s.id });
                  setOpen(false);
                }}
              >
                {s.name}
                {s.status === 'ACTIVE' && (
                  <span className="ml-auto text-[10px] text-green-500">ACTIVE</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
