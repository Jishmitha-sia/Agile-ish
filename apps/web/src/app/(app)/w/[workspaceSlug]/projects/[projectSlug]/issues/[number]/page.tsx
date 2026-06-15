'use client';

import { IssuePriority, IssueStatus, IssueType, UpdateIssueRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Pencil, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TopBar } from '../../../../../../../../components/app-shell/top-bar.js';
import { AssigneePicker } from '../../../../../../../../components/issues/assignee-picker.js';
import {
  IssueIdentifier,
  MarkdownBody,
  PriorityIcon,
  SidebarField,
  StatusBadge,
  TypeIcon,
  priorityLabel,
  statusLabel,
  typeLabel,
} from '../../../../../../../../components/issues/issue-presentation.js';
import { Button } from '../../../../../../../../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../../../../components/ui/dialog.js';
import { FormField } from '../../../../../../../../components/ui/form-field.js';
import { Input } from '../../../../../../../../components/ui/input.js';
import { Spinner } from '../../../../../../../../components/ui/spinner.js';
import { Textarea } from '../../../../../../../../components/ui/textarea.js';
import {
  useDeleteIssue,
  useIssue,
  useUpdateIssue,
} from '../../../../../../../../hooks/use-issues.js';
import { ApiError } from '../../../../../../../../lib/api-error.js';
import { useAuthStore } from '../../../../../../../../stores/auth.store.js';

import type {
  Issue,
  UpdateIssueRequest as UpdateIssueRequestType,
  UserId,
} from '@agile-ish/contracts';

const SELECT_CLASSES =
  'flex h-8 w-full rounded-md border border-input bg-background px-2 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

/**
 * Issue detail page.
 *
 * Two modes:
 *   • Read mode (default) — title + markdown body + sidebar with inline
 *     status / priority / assignee / due-date pickers. Inline pickers fire
 *     individual PATCH requests so the user feels the change immediately.
 *   • Edit mode — Edit button swaps the title + body into a form. Save
 *     commits both, Cancel discards. Cleaner than per-field inline editing
 *     for two long-form fields where typos mid-edit aren't recoverable.
 */
export default function IssueDetailPage() {
  const params = useParams<{
    workspaceSlug: string;
    projectSlug: string;
    number: string;
  }>();
  const { workspaceSlug, projectSlug } = params;
  const number = Number.parseInt(params.number, 10);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canDelete = membership
    ? membership.role === 'OWNER' || membership.role === 'ADMIN'
    : false;

  const { data: issue, isLoading } = useIssue(workspaceSlug, projectSlug, number);

  return (
    <>
      <TopBar
        title={issue ? issue.identifier : `#${params.number}`}
        description={issue?.title}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/w/${workspaceSlug}/projects/${projectSlug}`}>
              <ArrowLeft /> Back
            </Link>
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl">
          {isLoading || !issue ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_240px]">
              <IssueBody
                issue={issue}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
                canDelete={canDelete}
                onDeleted={() =>
                  router.replace(`/w/${workspaceSlug}/projects/${projectSlug}`)
                }
              />
              <IssueSidebar
                issue={issue}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// ─── Body: title + markdown + edit/delete affordances ─────────────────────

function IssueBody({
  issue,
  workspaceSlug,
  projectSlug,
  canDelete,
  onDeleted,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="space-y-4">
      <IssueIdentifier identifier={issue.identifier} />
      {editing ? (
        <EditForm
          issue={issue}
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
          onClose={() => setEditing(false)}
        />
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            {canDelete ? (
              <DeleteIssueDialog
                issue={issue}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
                onDeleted={onDeleted}
              />
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <MarkdownBody>{issue.description}</MarkdownBody>
          </div>
        </>
      )}
    </section>
  );
}

function EditForm({
  issue,
  workspaceSlug,
  projectSlug,
  onClose,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
  onClose: () => void;
}) {
  const update = useUpdateIssue(workspaceSlug, projectSlug, issue.number);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateIssueRequestType>({
    resolver: zodResolver(UpdateIssueRequest),
    defaultValues: {
      title: issue.title,
      description: issue.description ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        title: values.title,
        description: values.description?.toString().trim() ? values.description : null,
      });
      toast.success('Issue updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the issue.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField id="title" label="Title" error={errors.title?.message}>
        <Input {...register('title')} />
      </FormField>
      <FormField
        id="description"
        label="Description"
        helperText="Markdown supported."
        error={errors.description?.message}
      >
        <Textarea rows={10} {...register('description')} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          <X /> Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || update.isPending || !isDirty}>
          {isSubmitting || update.isPending ? <Spinner /> : <Save />}
          Save changes
        </Button>
      </div>
    </form>
  );
}

function DeleteIssueDialog({
  issue,
  workspaceSlug,
  projectSlug,
  onDeleted,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteIssue(workspaceSlug, projectSlug, issue.number);
  const handle = async () => {
    try {
      await remove.mutateAsync();
      toast.success(`Deleted ${issue.identifier}`);
      setOpen(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the issue.');
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {issue.identifier}?</DialogTitle>
          <DialogDescription>
            Soft-deletes the issue. ADMINs can restore within 30 days (UI lands in a
            future polish batch).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => void handle()}
          >
            {remove.isPending ? <Spinner /> : null}
            Delete issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sidebar: inline status/priority/assignee/due-date pickers ────────────

function IssueSidebar({
  issue,
  workspaceSlug,
  projectSlug,
}: {
  issue: Issue;
  workspaceSlug: string;
  projectSlug: string;
}) {
  const update = useUpdateIssue(workspaceSlug, projectSlug, issue.number);

  const patch = async (input: UpdateIssueRequestType, successMessage: string) => {
    try {
      await update.mutateAsync(input);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the issue.');
    }
  };

  // dueDate <input type="date"> uses local YYYY-MM-DD; convert from + to ISO.
  const [dueDateInput, setDueDateInput] = useState<string>(
    issue.dueDate ? issue.dueDate.slice(0, 10) : '',
  );
  useEffect(() => {
    setDueDateInput(issue.dueDate ? issue.dueDate.slice(0, 10) : '');
  }, [issue.dueDate]);

  const onDueDateBlur = async () => {
    const next = dueDateInput
      ? new Date(`${dueDateInput}T00:00:00.000Z`).toISOString()
      : null;
    if ((next ?? null) === (issue.dueDate ?? null)) return;
    await patch({ dueDate: next }, next ? 'Due date set' : 'Due date cleared');
  };

  return (
    <aside className="space-y-3 self-start rounded-lg border border-border bg-card p-4 text-sm">
      <SidebarField label="Type">
        <div className="flex items-center gap-2">
          <TypeIcon type={issue.type} />
          <select
            value={issue.type}
            onChange={(e) =>
              void patch({ type: e.target.value as Issue['type'] }, 'Type updated')
            }
            className={SELECT_CLASSES}
          >
            {IssueType.options.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </SidebarField>
      <SidebarField label="Status">
        <select
          value={issue.status}
          onChange={(e) =>
            void patch({ status: e.target.value as Issue['status'] }, 'Status updated')
          }
          className={SELECT_CLASSES}
        >
          {IssueStatus.options.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </SidebarField>
      <SidebarField label="Priority">
        <div className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority} />
          <select
            value={issue.priority}
            onChange={(e) =>
              void patch(
                { priority: e.target.value as Issue['priority'] },
                'Priority updated',
              )
            }
            className={SELECT_CLASSES}
          >
            {IssuePriority.options.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </SidebarField>
      <SidebarField label="Assignee">
        <AssigneePicker
          workspaceSlug={workspaceSlug}
          value={issue.assignee}
          onChange={(next: UserId | null) =>
            void patch(
              { assigneeUserId: next },
              next ? 'Assignee updated' : 'Assignee cleared',
            )
          }
        />
      </SidebarField>
      <SidebarField label="Due">
        <input
          type="date"
          value={dueDateInput}
          onChange={(e) => setDueDateInput(e.target.value)}
          onBlur={() => void onDueDateBlur()}
          className={SELECT_CLASSES}
        />
      </SidebarField>
      <hr className="border-border" />
      <SidebarField label="State">
        <StatusBadge status={issue.status} />
      </SidebarField>
      {issue.createdBy ? (
        <SidebarField label="Author">
          <span className="truncate">{issue.createdBy.displayName}</span>
        </SidebarField>
      ) : null}
      <SidebarField label="Created">
        <span className="text-muted-foreground">
          {new Date(issue.createdAt).toLocaleDateString()}
        </span>
      </SidebarField>
    </aside>
  );
}
