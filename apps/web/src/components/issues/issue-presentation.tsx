'use client';

import { cn } from '@agile-ish/ui';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bug,
  CheckSquare,
  CircleDashed,
  CircleDot,
  CircleEllipsis,
  CircleSlash,
  Equal,
  Eye,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { IssuePriority, IssueStatus, IssueType } from '@agile-ish/contracts';

/**
 * Tiny presentation pieces shared across the issue list, board, and detail
 * pages. Kept in one file so the visual language (status colours, priority
 * iconography) stays consistent — if we change a colour, we change it once.
 */

// ─── Status ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<IssueStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Todo',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_TONE: Record<IssueStatus, string> = {
  BACKLOG: 'text-muted-foreground',
  TODO: 'text-sky-400',
  IN_PROGRESS: 'text-amber-400',
  IN_REVIEW: 'text-purple-400',
  DONE: 'text-emerald-400',
  CANCELLED: 'text-muted-foreground/70',
};

const STATUS_BADGE_TONE: Record<IssueStatus, string> = {
  BACKLOG: 'bg-muted text-muted-foreground',
  TODO: 'bg-sky-500/15 text-sky-400',
  IN_PROGRESS: 'bg-amber-500/15 text-amber-400',
  IN_REVIEW: 'bg-purple-500/15 text-purple-400',
  DONE: 'bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'bg-muted text-muted-foreground/70 line-through',
};

const STATUS_ICON: Record<IssueStatus, typeof CircleDashed> = {
  BACKLOG: CircleDashed,
  TODO: CircleDot,
  IN_PROGRESS: CircleEllipsis,
  IN_REVIEW: Eye,
  DONE: CircleDot,
  CANCELLED: CircleSlash,
};

export function statusLabel(s: IssueStatus): string {
  return STATUS_LABEL[s];
}

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return <Icon className={cn('size-4 shrink-0', STATUS_TONE[status], className)} />;
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        STATUS_BADGE_TONE[status],
      )}
    >
      <StatusIcon status={status} className="size-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Priority ────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  NONE: 'No priority',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const PRIORITY_TONE: Record<IssuePriority, string> = {
  NONE: 'text-muted-foreground/60',
  LOW: 'text-sky-400',
  MEDIUM: 'text-amber-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};

const PRIORITY_ICON: Record<IssuePriority, typeof Equal> = {
  NONE: Equal,
  LOW: ArrowDown,
  MEDIUM: Equal,
  HIGH: ArrowUp,
  URGENT: AlertCircle,
};

export function priorityLabel(p: IssuePriority): string {
  return PRIORITY_LABEL[p];
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  const Icon = PRIORITY_ICON[priority];
  return <Icon className={cn('size-4 shrink-0', PRIORITY_TONE[priority], className)} />;
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', PRIORITY_TONE[priority])}>
      <PriorityIcon priority={priority} className="size-3" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

// ─── Type ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<IssueType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  CHORE: 'Chore',
  TASK: 'Task',
};

const TYPE_TONE: Record<IssueType, string> = {
  BUG: 'text-red-400',
  FEATURE: 'text-violet-400',
  CHORE: 'text-orange-400',
  TASK: 'text-muted-foreground',
};

const TYPE_BADGE_TONE: Record<IssueType, string> = {
  BUG: 'bg-red-500/15 text-red-400',
  FEATURE: 'bg-violet-500/15 text-violet-400',
  CHORE: 'bg-orange-500/15 text-orange-400',
  TASK: 'bg-muted text-muted-foreground',
};

const TYPE_ICON: Record<IssueType, typeof Bug> = {
  BUG: Bug,
  FEATURE: Sparkles,
  CHORE: Wrench,
  TASK: CheckSquare,
};

export function typeLabel(t: IssueType): string {
  return TYPE_LABEL[t];
}

export function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return (
    <Icon
      className={cn('size-4 shrink-0', TYPE_TONE[type], className)}
      aria-label={TYPE_LABEL[type]}
    />
  );
}

export function TypeBadge({ type }: { type: IssueType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
        TYPE_BADGE_TONE[type],
      )}
    >
      <TypeIcon type={type} className="size-3" />
      {TYPE_LABEL[type]}
    </span>
  );
}

// ─── Markdown body ───────────────────────────────────────────────────────

/**
 * Single-source markdown renderer for issue descriptions. Tailwind prose
 * gives sane defaults; GFM enables tables + task lists + autolinks. We
 * intentionally do NOT enable raw HTML — markdown only, defensive against
 * injection via pasted content.
 */
export function MarkdownBody({ children }: { children: string | null | undefined }) {
  if (!children?.trim()) {
    return <p className="text-muted-foreground/70 text-sm">No description.</p>;
  }
  return (
    <div className="prose prose-sm prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

// ─── Identifier + due-date helpers ───────────────────────────────────────

export function IssueIdentifier({ identifier }: { identifier: string }) {
  return (
    <span className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
      {identifier}
    </span>
  );
}

export function dueDateLabel(iso: string | null): { label: string; tone: string } | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  const days = Math.round(ms / (24 * 3600 * 1000));
  if (ms < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: 'text-red-400' };
  if (days === 0) return { label: 'Due today', tone: 'text-amber-400' };
  if (days <= 3) return { label: `Due in ${days}d`, tone: 'text-amber-400' };
  return { label: `Due in ${days}d`, tone: 'text-muted-foreground' };
}

// ─── Field shell ─────────────────────────────────────────────────────────

/**
 * Compact label-value row used by the detail page sidebar.
 */
export function SidebarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}
