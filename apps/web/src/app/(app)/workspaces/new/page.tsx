'use client';

import { CreateWorkspaceRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '../../../../components/ui/button.js';
import { FormField } from '../../../../components/ui/form-field.js';
import { Input } from '../../../../components/ui/input.js';
import { Spinner } from '../../../../components/ui/spinner.js';
import { Textarea } from '../../../../components/ui/textarea.js';
import { useCreateWorkspace } from '../../../../hooks/use-workspaces.js';
import { ApiError } from '../../../../lib/api-error.js';
import { useAuthStore } from '../../../../stores/auth.store.js';

import type { CreateWorkspaceRequest as CreateWorkspaceRequestType } from '@agile-ish/contracts';

type CreateKey = keyof CreateWorkspaceRequestType;
const CREATE_KEYS: ReadonlySet<CreateKey> = new Set(['name', 'slug', 'description']);

/**
 * RHF feeds text inputs an empty string when cleared. Zod's `.optional()`
 * accepts `undefined`, not `""` — so without coercion an empty optional
 * field fails the min-length check. Strip empties on the way into the
 * form state so optional means optional.
 */
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export default function CreateWorkspacePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasExistingMemberships = (user?.memberships.length ?? 0) > 0;
  const create = useCreateWorkspace();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceRequestType>({
    resolver: zodResolver(CreateWorkspaceRequest),
    defaultValues: { name: '', slug: undefined, description: undefined },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: CreateWorkspaceRequestType = {
        name: values.name,
        ...(values.slug ? { slug: values.slug } : {}),
        ...(values.description ? { description: values.description } : {}),
      };
      const workspace = await create.mutateAsync(payload);
      toast.success(`${workspace.name} created`);
      router.replace(`/w/${workspace.slug}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (CREATE_KEYS.has(path as CreateKey)) {
              setError(path as CreateKey, { type: 'server', message: issue.message });
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
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {hasExistingMemberships ? (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
        ) : null}

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create a workspace</h1>
          <p className="text-sm text-muted-foreground">
            {hasExistingMemberships
              ? "Spin up a new workspace. You'll be its owner."
              : "You're not a member of any workspace yet. Create one to get started."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="name" label="Name" error={errors.name?.message}>
            <Input autoFocus placeholder="Acme Engineering" {...register('name')} />
          </FormField>

          <FormField
            id="slug"
            label="URL slug (optional)"
            helperText="3–32 chars, lowercase + hyphens. Defaults to a slug derived from the name."
            error={errors.slug?.message}
          >
            <Input
              placeholder="acme-eng"
              {...register('slug', { setValueAs: emptyToUndefined })}
            />
          </FormField>

          <FormField
            id="description"
            label="Description (optional)"
            error={errors.description?.message}
          >
            <Textarea
              rows={3}
              placeholder="What this workspace is for."
              {...register('description', { setValueAs: emptyToUndefined })}
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={isSubmitting || create.isPending}>
            {isSubmitting || create.isPending ? <Spinner /> : null}
            Create workspace
          </Button>
        </form>
      </div>
    </div>
  );
}
