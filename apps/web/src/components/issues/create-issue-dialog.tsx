'use client';

import { CreateIssueRequest, IssuePriority, IssueStatus, IssueType } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useCreateIssue } from '../../hooks/use-issues.js';
import { useMembers } from '../../hooks/use-members.js';
import { ApiError } from '../../lib/api-error.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { FormField } from '../ui/form-field.js';
import { Input } from '../ui/input.js';
import { Spinner } from '../ui/spinner.js';
import { Textarea } from '../ui/textarea.js';

import { typeLabel } from './issue-presentation.js';

import type { CreateIssueRequest as CreateIssueRequestType } from '@agile-ish/contracts';

const SELECT_CLASSES =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export function CreateIssueDialog({
  workspaceSlug,
  projectSlug,
  trigger,
}: {
  workspaceSlug: string;
  projectSlug: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateIssue(workspaceSlug, projectSlug);
  const { data: members } = useMembers(workspaceSlug);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateIssueRequestType>({
    resolver: zodResolver(CreateIssueRequest),
    defaultValues: {
      title: '',
      description: undefined,
      type: 'TASK',
      status: 'BACKLOG',
      priority: 'NONE',
      assigneeUserId: null,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: CreateIssueRequestType = {
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        ...(values.type ? { type: values.type } : {}),
        ...(values.status ? { status: values.status } : {}),
        ...(values.priority ? { priority: values.priority } : {}),
        ...(values.assigneeUserId !== undefined
          ? { assigneeUserId: values.assigneeUserId }
          : {}),
      };
      const issue = await create.mutateAsync(payload);
      toast.success(`Created ${issue.identifier}`);
      reset({
        title: '',
        description: undefined,
        type: 'TASK',
        status: 'BACKLOG',
        priority: 'NONE',
        assigneeUserId: null,
      });
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (
              path === 'title' ||
              path === 'description' ||
              path === 'type' ||
              path === 'status' ||
              path === 'priority' ||
              path === 'assigneeUserId'
            ) {
              setError(path, {
                type: 'server',
                message: issue.message,
              });
            }
          }
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Could not create the issue.');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> New issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            Short title, optional Markdown body. Status and priority can change later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="title" label="Title" error={errors.title?.message}>
            <Input
              autoFocus
              placeholder="Wire up the login form"
              {...register('title')}
            />
          </FormField>
          <FormField
            id="description"
            label="Description"
            helperText="Markdown supported."
            error={errors.description?.message}
          >
            <Textarea
              rows={5}
              placeholder="What needs to happen?"
              {...register('description', { setValueAs: emptyToUndefined })}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="type" label="Type" error={errors.type?.message}>
              <select {...register('type')} className={SELECT_CLASSES}>
                {IssueType.options.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="status" label="Status" error={errors.status?.message}>
              <select {...register('status')} className={SELECT_CLASSES}>
                {IssueStatus.options.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="priority" label="Priority" error={errors.priority?.message}>
              <select {...register('priority')} className={SELECT_CLASSES}>
                {IssuePriority.options.map((p) => (
                  <option key={p} value={p}>
                    {p.toLowerCase()}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="assigneeUserId"
              label="Assignee"
              error={errors.assigneeUserId?.message}
            >
              <select
                {...register('assigneeUserId', {
                  setValueAs: (v: string | null) => (v === '' || v === null ? null : v),
                })}
                className={SELECT_CLASSES}
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {(members ?? []).map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.displayName}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || create.isPending}>
              {isSubmitting || create.isPending ? <Spinner /> : null}
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
