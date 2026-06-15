'use client';

import {
  ISSUE_STATUS_ORDER,
  ISSUE_TYPE_ORDER,
  type IssueStatus,
  type IssueType,
 type Issue } from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import { ListTodo, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { TopBar } from '../../../../../../components/app-shell/top-bar.js';
import { CreateIssueDialog } from '../../../../../../components/issues/create-issue-dialog.js';
import {
  IssueIdentifier,
  PriorityIcon,
  StatusBadge,
  StatusIcon,
  TypeIcon,
  dueDateLabel,
  statusLabel,
  typeLabel,
} from '../../../../../../components/issues/issue-presentation.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../../../../../../components/ui/avatar.js';
import { Button } from '../../../../../../components/ui/button.js';
import { Spinner } from '../../../../../../components/ui/spinner.js';
import { useIssues } from '../../../../../../hooks/use-issues.js';
import { useProject } from '../../../../../../hooks/use-projects.js';


/**
 * Project home — the issues list.
 *
 * Phase 3 Batch B will add a board-view toggle (DnD Kit kanban). For
 * Batch A this is a dense row-based list with a status filter chip-row.
 */
export default function ProjectHomePage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<IssueType | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(
    workspaceSlug,
    projectSlug,
  );
  const { data: issues, isLoading: issuesLoading } = useIssues(
    workspaceSlug,
    projectSlug,
    statusFilter || typeFilter
      ? {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(typeFilter ? { type: typeFilter } : {}),
        }
      : undefined,
  );

  return (
    <>
      <TopBar
        title={project?.name ?? projectSlug}
        description={
          project ? `${project.identifierPrefix} · ${project.issueCounter} issues` : undefined
        }
        actions={
          <>
            <CreateIssueDialog workspaceSlug={workspaceSlug} projectSlug={projectSlug} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/w/${workspaceSlug}/projects/${projectSlug}/settings`}>
                <Settings /> Settings
              </Link>
            </Button>
          </>
        }
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {projectLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : project ? (
            <header className="space-y-2">
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

          <div className="space-y-2">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <TypeFilter value={typeFilter} onChange={setTypeFilter} />
          </div>

          {issuesLoading ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : !issues || issues.length === 0 ? (
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
              {issues.map((issue) => (
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
        issue.status === 'DONE' || issue.status === 'CANCELLED'
          ? 'opacity-70'
          : '',
      )}
    >
      <TypeIcon type={issue.type} />
      <PriorityIcon priority={issue.priority} />
      <StatusIcon status={issue.status} />
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
          Capture the first piece of work. Drag-and-drop board, sprints, and comments
          land in the next batches.
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
