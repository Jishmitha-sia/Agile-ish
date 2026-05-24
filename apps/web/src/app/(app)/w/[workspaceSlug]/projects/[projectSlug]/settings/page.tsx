'use client';

import { UpdateProjectRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TopBar } from '../../../../../../../components/app-shell/top-bar.js';
import { Button } from '../../../../../../../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../../../components/ui/dialog.js';
import { FormField } from '../../../../../../../components/ui/form-field.js';
import { Input } from '../../../../../../../components/ui/input.js';
import { Spinner } from '../../../../../../../components/ui/spinner.js';
import { Textarea } from '../../../../../../../components/ui/textarea.js';
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from '../../../../../../../hooks/use-projects.js';
import { ApiError } from '../../../../../../../lib/api-error.js';
import { useAuthStore } from '../../../../../../../stores/auth.store.js';

import type { UpdateProjectRequest as UpdateProjectRequestType } from '@agile-ish/contracts';

/**
 * Project settings — Batch B scope: rename + description + delete.
 * ADMIN+ can edit and delete. The identifier prefix is fixed at creation
 * (changing it would break every issue identifier already minted).
 */

const SettingsForm = UpdateProjectRequest.pick({ name: true, description: true });
type SettingsFormType = Pick<UpdateProjectRequestType, 'name' | 'description'>;

export default function ProjectSettingsPage() {
  const params = useParams<{ workspaceSlug: string; projectSlug: string }>();
  const { workspaceSlug, projectSlug } = params;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canEdit = membership
    ? membership.role === 'OWNER' || membership.role === 'ADMIN'
    : false;

  const { data: project, isLoading } = useProject(workspaceSlug, projectSlug);
  const update = useUpdateProject(workspaceSlug, projectSlug);

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
    if (project) {
      reset({ name: project.name, description: project.description ?? '' });
    }
  }, [project, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: UpdateProjectRequestType = {
        name: values.name,
        description: values.description?.trim() ? values.description : null,
      };
      await update.mutateAsync(payload);
      toast.success('Project updated');
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
      <TopBar title="Project settings" description={project?.name ?? projectSlug} />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-2xl space-y-10">
          {isLoading || !project ? (
            <Spinner className="size-5 text-muted-foreground" />
          ) : (
            <>
              <SectionHeader
                title="General"
                description="Project name and description. The issue prefix is fixed at creation."
              />
              <form onSubmit={onSubmit} className="space-y-6" noValidate>
                <FormField id="name" label="Name" error={errors.name?.message}>
                  <Input {...register('name')} disabled={!canEdit} placeholder="Web App" />
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
                    placeholder="What this project is for."
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

              {canEdit ? (
                <>
                  <hr className="border-border" />
                  <SectionHeader
                    title="Danger zone"
                    description="Soft-deletes the project. Future issues and sprints would be hidden too."
                  />
                  <DeleteProjectCard
                    workspaceSlug={workspaceSlug}
                    projectSlug={projectSlug}
                    projectName={project.name}
                    onDeleted={() => router.replace(`/w/${workspaceSlug}`)}
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
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function DeleteProjectCard({
  workspaceSlug,
  projectSlug,
  projectName,
  onDeleted,
}: {
  workspaceSlug: string;
  projectSlug: string;
  projectName: string;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const remove = useDeleteProject(workspaceSlug, projectSlug);
  const canRemove = confirm === projectName;

  const handleConfirm = async () => {
    try {
      await remove.mutateAsync();
      toast.success(`${projectName} deleted`);
      setOpen(false);
      onDeleted();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not delete the project.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <p className="text-sm text-muted-foreground">
        Deleting <span className="font-semibold text-foreground">{projectName}</span> is
        reversible by an admin within 30 days. The issue prefix stays reserved within
        this workspace.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 /> Delete project
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {projectName}?</DialogTitle>
            <DialogDescription>
              Type{' '}
              <span className="font-mono text-foreground">{projectName}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={projectName}
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
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
