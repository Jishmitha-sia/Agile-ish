'use client';

import {
  ISSUE_STATUS_ORDER,
  ISSUE_TYPE_ORDER,
  type IssueStatus,
  type IssueType,
  type Issue,
} from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import { LayoutDashboard, LayoutList, ListTodo, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { TopBar } from '../../../../../../components/app-shell/top-bar.js';
import { CreateIssueDialog } from '../../../../../../components/issues/create-issue-dialog.js';
import {
  IssueIdentifier,
  StatusBadge,
  StatusIcon,
  TypeIcon,
  dueDateLabel,
  priorityLabel,
  statusLabel,
  typeLabel,
} from '../../../../../../components/issues/issue-presentation.js';
import { KanbanBoard } from '../../../../../../components/issues/kanban-board.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../../../../../../components/ui/avatar.js';
import { Button } from '../../../../../../components/ui/button.js';
import { Spinner } from '../../../../../../components/ui/spinner.js';
import { useIssues } from '../../../../../../hooks/use-issues.js';
import { useProject } from '../../../../../../hooks/use-projects.js';

type ViewMode = 'board' | 'list';

/**
 * Project home — Board view (default) + List view toggle.
 *
 * Phase 3 Batch B: DnD Kit kanban board with optimistic status mutations.
 * The list view from Batch A is preserved as a toggle.
 *
 * Board mode always fetches ALL issues (no statusFilter) and partitions
 * client-side into columns. typeFilter applies to both views.
 * List mode uses both statusFilter + typeFilter (original behaviour).
 */
export default function ProjectHomePage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<IssueType | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(
    workspaceSlug,
    projectSlug,
  );

  // Board mode: always fetch all issues — partitioned client-side into columns.
  // List mode: respect statusFilter + typeFilter (original Batch A behaviour).
  const listQuery =
    viewMode === 'list' && (statusFilter ?? typeFilter)
      ? {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(typeFilter ? { type: typeFilter } : {}),
        }
      : undefined;

  const { data: allIssues, isLoading: issuesLoading } = useIssues(
    workspaceSlug,
    projectSlug,
    listQuery,
  );

  // In board mode, filter by type client-side (no extra API call).
  const boardIssues =
    viewMode === 'board' && typeFilter
      ? (allIssues ?? []).filter((i) => i.type === typeFilter)
      : (allIssues ?? []);

  return (
    <>
      <TopBar
        title={project?.name ?? projectSlug}
        description={
          project ? `${project.identifierPrefix} · ${project.issueCounter} issues` : undefined
        }
        actions={
          <>
            {/* View toggle */}
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              <ViewToggleButton
                active={viewMode === 'board'}
                onClick={() => setViewMode('board')}
                title="Board view"
              >
                <LayoutDashboard className="size-3.5" />
              </ViewToggleButton>
              <ViewToggleButton
                active={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <LayoutList className="size-3.5" />
              </ViewToggleButton>
            </div>

            <CreateIssueDialog workspaceSlug={workspaceSlug} projectSlug={projectSlug} />

            <Button asChild variant="outline" size="sm">
              <Link href={`/w/${workspaceSlug}/projects/${projectSlug}/settings`}>
                <Settings /> Settings
              </Link>
            </Button>
          </>
        }
      />

      {/* Board view has its own scroll container (horizontal columns) */}
      <main
        className={cn(
          'flex-1 min-h-0',
          viewMode === 'board' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto',
        )}
      >
        <div
          className={cn(
            viewMode === 'board'
              ? 'flex flex-col flex-1 min-h-0 px-6 py-5'
              : 'mx-auto max-w-5xl space-y-5 px-8 py-6',
          )}
        >
          {/* Project header */}
          {projectLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : project ? (
            <header className="shrink-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-primary">
                  {project.identifierPrefix}
                </span>
                <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
              </div>
              {project.description ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  {project.description}
                </p>
              ) : null}
            </header>
          ) : null}

          {/* Filters — StatusFilter hidden on board (columns ARE the status) */}
          <div className="shrink-0 space-y-2">
            {viewMode === 'list' ? (
              <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            ) : null}
            <TypeFilter value={typeFilter} onChange={setTypeFilter} />
          </div>

          {/* Content area */}
          {issuesLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : viewMode === 'board' ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <KanbanBoard
                issues={boardIssues}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
              />
            </div>
          ) : !allIssues || allIssues.length === 0 ? (
            <EmptyIssues
              workspaceSlug={workspaceSlug}
              projectSlug={projectSlug}
              hasFilter={Boolean(statusFilter ?? typeFilter)}
              onClearFilter={() => {
                setStatusFilter(null);
                setTypeFilter(null);
              }}
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {allIssues.map((issue) => (
                <li key={issue.id}>
                  <IssueRow
                    issue={issue}
                    workspaceSlug={workspaceSlug}
                    projectSlug={projectSlug}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View toggle button
// ─────────────────────────────────────────────────────────────────────────────

function ViewToggleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded px-2 py-1 transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chips (list view only)
// ─────────────────────────────────────────────────────────────────────────────

function StatusFilter({
  value,
  onChange,
}: {
  value: IssueStatus | null;
  onChange: (next: IssueStatus | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip active={value === null} onClick={() => onChange(null)}>
        All
      </Chip>
      {ISSUE_STATUS_ORDER.map((s) => (
        <Chip key={s} active={value === s} onClick={() => onChange(s)}>
          <StatusIcon status={s} className="size-3" />
          {statusLabel(s)}
        </Chip>
      ))}
    </div>
  );
}

function TypeFilter({
  value,
  onChange,
}: {
  value: IssueType | null;
  onChange: (next: IssueType | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip active={value === null} onClick={() => onChange(null)}>
        Any type
      </Chip>
      {ISSUE_TYPE_ORDER.map((t) => (
        <Chip key={t} active={value === t} onClick={() => onChange(t)}>
          <TypeIcon type={t} className="size-3" />
          {typeLabel(t)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List view row
// ─────────────────────────────────────────────────────────────────────────────

function listPriorityClasses(priority: Issue['priority']): string {
  switch (priority) {
    case 'URGENT': return 'border border-red-500/60 bg-red-500/10 text-red-400';
    case 'HIGH':   return 'border border-orange-500/60 bg-orange-500/10 text-orange-400';
    case 'MEDIUM': return 'border border-amber-500/60 bg-amber-500/10 text-amber-400';
    case 'LOW':    return 'border border-green-500/60 bg-green-500/10 text-green-400';
    case 'NONE':   return 'bg-muted text-muted-foreground';
  }
}

function IssueRow({
  issue,
  workspaceSlug,
  projectSlug,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
}) {
  const due = dueDateLabel(issue.dueDate);
  const href = `/w/${workspaceSlug}/projects/${projectSlug}/issues/${issue.number}`;
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40',
        issue.status === 'DONE' || issue.status === 'CANCELLED' ? 'opacity-70' : '',
      )}
    >
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground">
        {typeLabel(issue.type)}
      </span>
      {issue.priority !== 'NONE' ? (
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', listPriorityClasses(issue.priority))}>
          {priorityLabel(issue.priority)}
        </span>
      ) : null}
      <IssueIdentifier identifier={issue.identifier} />
      <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
      {due ? (
        <span className={cn('hidden text-[11px] sm:inline', due.tone)}>{due.label}</span>
      ) : null}
      <div className="hidden sm:block">
        <StatusBadge status={issue.status} />
      </div>
      {issue.assignee ? (
        <Avatar className="size-6">
          {issue.assignee.avatarUrl ? (
            <AvatarImage src={issue.assignee.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="text-[9px]">
            {initialsOf(issue.assignee.displayName)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="size-6" aria-hidden />
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state (list view only)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyIssues({
  workspaceSlug,
  projectSlug,
  hasFilter,
  onClearFilter,
}: {
  workspaceSlug: string;
  projectSlug: string;
  hasFilter: boolean;
  onClearFilter: () => void;
}) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No issues match this filter.</p>
        <Button variant="outline" size="sm" onClick={onClearFilter}>
          Clear filter
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ListTodo className="size-6" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold">No issues yet</h4>
        <p className="max-w-sm text-sm text-muted-foreground">
          Capture the first piece of work. Sprints and comments land in the next batch.
        </p>
      </div>
      <CreateIssueDialog
        workspaceSlug={workspaceSlug}
        projectSlug={projectSlug}
        trigger={<Button size="sm">Create your first issue</Button>}
      />
    </div>
  );
}
