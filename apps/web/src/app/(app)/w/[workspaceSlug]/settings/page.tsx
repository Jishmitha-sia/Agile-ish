'use client';

import { UpdateWorkspaceRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TopBar } from '../../../../../components/app-shell/top-bar.js';
import { Button } from '../../../../../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../components/ui/dialog.js';
import { FormField } from '../../../../../components/ui/form-field.js';
import { Input } from '../../../../../components/ui/input.js';
import { Spinner } from '../../../../../components/ui/spinner.js';
import { Textarea } from '../../../../../components/ui/textarea.js';
import {
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspace,
} from '../../../../../hooks/use-workspaces.js';
import { ApiError } from '../../../../../lib/api-error.js';
import { useAuthStore } from '../../../../../stores/auth.store.js';

import type { UpdateWorkspaceRequest as UpdateWorkspaceRequestType } from '@agile-ish/contracts';

/**
 * Workspace settings — Batch A scope: rename, description, and the
 * delete-workspace danger zone.
 *
 * Slug renames and avatar upload defer until there's actual demand —
 * slug rename involves redirects + search engine implications; avatar
 * upload needs an object-store pipeline that doesn't exist yet.
 */

// Tighten the contract to the fields the form actually edits.
const SettingsForm = UpdateWorkspaceRequest.pick({ name: true, description: true });
type SettingsFormType = Pick<UpdateWorkspaceRequestType, 'name' | 'description'>;

export default function WorkspaceSettingsPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canEdit = membership ? membership.role === 'OWNER' || membership.role === 'ADMIN' : false;
  const canDelete = membership?.role === 'OWNER';

  const { data: workspace, isLoading } = useWorkspace(workspaceSlug);
  const update = useUpdateWorkspace(workspaceSlug);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormType>({
    resolver: zodResolver(SettingsForm),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (workspace) {
      reset({ name: workspace.name, description: workspace.description ?? '' });
    }
  }, [workspace, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: UpdateWorkspaceRequestType = {
        name: values.name,
        description: values.description?.trim() ? values.description : null,
      };
      await update.mutateAsync(payload);
      toast.success('Workspace updated');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (path === 'name' || path === 'description') {
              setError(path, { type: 'server', message: issue.message });
            }
          }
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  });

  return (
    <>
      <TopBar title="Settings" description={workspace?.name ?? workspaceSlug} />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-2xl space-y-10">
          {isLoading || !workspace ? (
            <Spinner className="text-muted-foreground size-5" />
          ) : (
            <>
              <SectionHeader
                title="General"
                description="Workspace name and description. Visible to every member."
              />
              <form onSubmit={onSubmit} className="space-y-6" noValidate>
                <FormField id="name" label="Name" error={errors.name?.message}>
                  <Input {...register('name')} disabled={!canEdit} placeholder="Acme Engineering" />
                </FormField>
                <FormField
                  id="description"
                  label="Description"
                  helperText="Optional. Up to 500 characters."
                  error={errors.description?.message}
                >
                  <Textarea
                    {...register('description')}
                    disabled={!canEdit}
                    rows={4}
                    placeholder="What this workspace is for."
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!canEdit || !isDirty || isSubmitting || update.isPending}
                  >
                    {isSubmitting || update.isPending ? <Spinner /> : null}
                    Save changes
                  </Button>
                </div>
              </form>

              {canDelete ? (
                <>
                  <hr className="border-border" />
                  <SectionHeader
                    title="Danger zone"
                    description="Soft-deletes the workspace. Members lose access immediately."
                  />
                  <DeleteWorkspaceCard
                    workspaceName={workspace.name}
                    workspaceSlug={workspaceSlug}
                    onDeleted={() => router.replace('/')}
                  />
                </>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold leading-tight">{title}</h2>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}

function DeleteWorkspaceCard({
  workspaceName,
  workspaceSlug,
  onDeleted,
}: {
  workspaceName: string;
  workspaceSlug: string;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const remove = useDeleteWorkspace(workspaceSlug);
  const canRemove = confirm === workspaceName;

  const handleConfirm = async () => {
    try {
      await remove.mutateAsync();
      toast.success(`${workspaceName} deleted`);
      setOpen(false);
      onDeleted();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not delete the workspace.';
      toast.error(message);
    }
  };

  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-4 rounded-lg border p-6">
      <p className="text-muted-foreground text-sm">
        Deleting <span className="text-foreground font-semibold">{workspaceName}</span> is
        reversible by an admin within 30 days. Projects, sprints, and issues are hidden but not
        permanently destroyed.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 /> Delete workspace
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {workspaceName}?</DialogTitle>
            <DialogDescription>
              This soft-deletes the workspace immediately and revokes access for everyone. Type{' '}
              <span className="text-foreground font-mono">{workspaceName}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={workspaceName}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canRemove || remove.isPending}
              onClick={() => void handleConfirm()}
            >
              {remove.isPending ? <Spinner /> : null}
              Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
