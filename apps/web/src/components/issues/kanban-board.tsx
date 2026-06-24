'use client';

import { ISSUE_STATUS_ORDER, type Issue, type IssueStatus } from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { ListTodo, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useUpdateIssue } from '../../hooks/use-issues.js';
import { ApiError } from '../../lib/api-error.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../ui/avatar.js';
import { Button } from '../ui/button.js';

import { CreateIssueDialog } from './create-issue-dialog.js';
import {
  IssueIdentifier,
  StatusIcon,
  dueDateLabel,
  priorityLabel,
  statusLabel,
  typeLabel,
} from './issue-presentation.js';

// ─────────────────────────────────────────────────────────────────────────────
// Column config — DONE and CANCELLED are visually de-emphasised (muted header,
// lower card opacity) so active work stands out but completed items are still
// visible. No collapsing yet — that can come when sprint scoping makes it
// necessary (Phase 3 Batch C+).
// ─────────────────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = new Set<IssueStatus>(['DONE', 'CANCELLED']);

/** Maps priority → colored border + text classes for the card badge. */
function priorityBadgeClasses(priority: Issue['priority']): string {
  switch (priority) {
    case 'URGENT':
      return 'border border-red-500/60 bg-red-500/10 text-red-400';
    case 'HIGH':
      return 'border border-orange-500/60 bg-orange-500/10 text-orange-400';
    case 'MEDIUM':
      return 'border border-amber-500/60 bg-amber-500/10 text-amber-400';
    case 'LOW':
      return 'border border-green-500/60 bg-green-500/10 text-green-400';
    case 'NONE':
      return 'bg-muted text-muted-foreground';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  issues: Issue[];
  workspaceSlug: string;
  projectSlug: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root board
// ─────────────────────────────────────────────────────────────────────────────

export function KanbanBoard({ issues, workspaceSlug, projectSlug }: KanbanBoardProps) {
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  // We need one mutation instance per issue number being dragged. Because we
  // only ever drag one card at a time, we create the mutation with the active
  // issue's number when drag starts and keep it for the drag lifecycle.
  const [draggingNumber, setDraggingNumber] = useState<number | null>(null);
  const updateIssue = useUpdateIssue(workspaceSlug, projectSlug, draggingNumber ?? 0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 5px movement before starting drag so accidental taps on
      // the card link don't initiate a drag.
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const columnMap = buildColumnMap(issues);

  // Custom collision detection: prefer pointer-within for the column droppables
  // first, fall back to rect intersection. This prevents card-vs-column
  // ambiguity when dragging over a column that already has cards in it.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const issue = issues.find((i) => i.id === active.id);
    if (!issue) return;
    setActiveIssue(issue);
    setDraggingNumber(issue.number);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveIssue(null);

    if (!over) return;
    // Guard: over.id must be a valid IssueStatus (column id), not a card id.
    const targetStatus = over.id as IssueStatus;
    if (!ISSUE_STATUS_ORDER.includes(targetStatus)) return;
    const issue = issues.find((i) => i.id === active.id);
    if (!issue || issue.status === targetStatus) return;

    updateIssue.mutate(
      { status: targetStatus },
      {
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not move the issue.');
        },
      },
    );
  };

  const handleDragCancel = () => {
    setActiveIssue(null);
  };

  // Empty board — shown when project has no issues at all.
  if (issues.length === 0) {
    return (
      <div className="border-border bg-card/40 flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
          <ListTodo className="size-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-semibold">No issues yet</h4>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create your first issue to see it on the board.
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Horizontal scroll — h-full so columns can scroll independently */}
      <div className="flex h-full gap-3 overflow-x-auto pb-4">
        {ISSUE_STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnMap[status] ?? []}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            isDimmed={COMPLETED_STATUSES.has(status)}
          />
        ))}
      </div>

      {/* Ghost card shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <KanbanCard
            issue={activeIssue}
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column
// ─────────────────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  issues,
  workspaceSlug,
  projectSlug,
  isDimmed,
}: {
  status: IssueStatus;
  issues: Issue[];
  workspaceSlug: string;
  projectSlug: string;
  isDimmed: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-2">
      {/* Column header */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5',
          isDimmed ? 'opacity-60' : '',
        )}
      >
        <StatusIcon status={status} className="size-3.5" />
        <span
          className={cn(
            'text-xs font-medium',
            isDimmed ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {statusLabel(status)}
        </span>
        <span className="bg-muted text-muted-foreground ml-auto rounded-full px-1.5 py-0.5 text-[10px]">
          {issues.length}
        </span>
        <CreateIssueDialog
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
          defaultStatus={status}
          trigger={
            <button
              type="button"
              title={`New ${statusLabel(status)} issue`}
              className="text-muted-foreground/40 hover:bg-accent hover:text-foreground rounded p-0.5 transition-colors"
            >
              <Plus className="size-3.5" />
            </button>
          }
        />
      </div>

      {/* Drop zone — flex-1 + overflow-y-auto so the column scrolls when cards overflow */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border p-2 transition-colors duration-150',
          isOver ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-muted/5',
          isDimmed ? 'opacity-70' : '',
        )}
      >
        <AnimatePresence initial={false}>
          {issues.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center"
            >
              {/* Intentionally empty — quiet like Linear */}
            </motion.div>
          ) : (
            issues.map((issue) => (
              <motion.div
                key={issue.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <KanbanCard issue={issue} workspaceSlug={workspaceSlug} projectSlug={projectSlug} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

function KanbanCard({
  issue,
  workspaceSlug,
  projectSlug,
  isOverlay = false,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: issue.id,
  });

  const due = dueDateLabel(issue.dueDate);
  const href = `/w/${workspaceSlug}/projects/${projectSlug}/issues/${issue.number}`;

  // Apply DnD transform via inline style (not Tailwind — it's dynamic)
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-border bg-card group relative rounded-md border p-3 shadow-sm transition-shadow',
        isDragging && !isOverlay ? 'opacity-40 shadow-none' : '',
        isOverlay ? 'ring-primary/40 rotate-1 shadow-2xl ring-2' : 'hover:shadow-md',
        'cursor-grab active:cursor-grabbing',
      )}
      {...listeners}
      {...attributes}
    >
      {/* Identifier */}
      <IssueIdentifier identifier={issue.identifier} />

      {/* Title — link to detail page; click still navigates if not dragging */}
      <Link
        href={href}
        className="text-foreground group-hover:text-primary/90 mt-1 block text-sm font-medium leading-snug"
        onClick={(e) => {
          // Prevent navigation while dragging
          if (isDragging) e.preventDefault();
        }}
        draggable={false}
      >
        <span className="line-clamp-2">{issue.title}</span>
      </Link>

      {/* Footer row — text labels only, no icons */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
          {typeLabel(issue.type)}
        </span>
        {issue.priority !== 'NONE' ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              priorityBadgeClasses(issue.priority),
            )}
          >
            {priorityLabel(issue.priority)}
          </span>
        ) : null}
        {due ? (
          <span className={cn('ml-auto text-[10px]', due.tone)}>{due.label}</span>
        ) : (
          <span className="ml-auto" />
        )}
        {issue.assignee ? (
          <Avatar className="size-5">
            {issue.assignee.avatarUrl ? (
              <AvatarImage src={issue.assignee.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-[8px]">
              {initialsOf(issue.assignee.displayName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildColumnMap(issues: Issue[]): Record<IssueStatus, Issue[]> {
  const map = Object.fromEntries(ISSUE_STATUS_ORDER.map((s) => [s, [] as Issue[]])) as Record<
    IssueStatus,
    Issue[]
  >;
  for (const issue of issues) {
    map[issue.status].push(issue);
  }
  return map;
}
