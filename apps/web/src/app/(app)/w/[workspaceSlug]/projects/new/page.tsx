'use client';

import { CreateProjectRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '../../../../../../components/ui/button.js';
import { FormField } from '../../../../../../components/ui/form-field.js';
import { Input } from '../../../../../../components/ui/input.js';
import { Spinner } from '../../../../../../components/ui/spinner.js';
import { Textarea } from '../../../../../../components/ui/textarea.js';
import { useCreateProject } from '../../../../../../hooks/use-projects.js';
import { ApiError } from '../../../../../../lib/api-error.js';
import { useAuthStore } from '../../../../../../stores/auth.store.js';

import type { CreateProjectRequest as CreateProjectRequestType } from '@agile-ish/contracts';

type CreateKey = keyof CreateProjectRequestType;
const CREATE_KEYS: ReadonlySet<CreateKey> = new Set([
  'name',
  'slug',
  'identifierPrefix',
  'description',
]);

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export default function CreateProjectPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canCreate = membership ? membership.role === 'OWNER' || membership.role === 'ADMIN' : false;
  const create = useCreateProject(workspaceSlug);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectRequestType>({
    resolver: zodResolver(CreateProjectRequest),
    defaultValues: {
      name: '',
      slug: undefined,
      identifierPrefix: undefined,
      description: undefined,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: CreateProjectRequestType = {
        name: values.name,
        ...(values.slug ? { slug: values.slug } : {}),
        ...(values.identifierPrefix ? { identifierPrefix: values.identifierPrefix } : {}),
        ...(values.description ? { description: values.description } : {}),
      };
      const project = await create.mutateAsync(payload);
      toast.success(`${project.name} created`);
      router.replace(`/w/${workspaceSlug}/projects/${project.slug}`);
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

  if (!canCreate) {
    return (
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">You can&apos;t create projects here</h1>
          <p className="text-muted-foreground text-sm">
            Only workspace admins can create projects. Ask an admin to do it for you.
          </p>
          <Button asChild variant="outline">
            <Link href={`/w/${workspaceSlug}`}>Back to workspace</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-8 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <Link
          href={`/w/${workspaceSlug}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create a project</h1>
          <p className="text-muted-foreground text-sm">
            Projects own issues, sprints, and boards (coming in Phase 3).
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="name" label="Name" error={errors.name?.message}>
            <Input autoFocus placeholder="Web App" {...register('name')} />
          </FormField>

          <FormField
            id="identifierPrefix"
            label="Issue prefix (optional)"
            helperText="2–8 uppercase letters. Issues will read e.g. ENG-1. Defaults to letters derived from the name."
            error={errors.identifierPrefix?.message}
          >
            <Input
              placeholder="ENG"
              {...register('identifierPrefix', { setValueAs: emptyToUndefined })}
            />
          </FormField>

          <FormField
            id="slug"
            label="URL slug (optional)"
            helperText="2–32 chars, lowercase + hyphens. Defaults to a slug derived from the name."
            error={errors.slug?.message}
          >
            <Input placeholder="web-app" {...register('slug', { setValueAs: emptyToUndefined })} />
          </FormField>

          <FormField
            id="description"
            label="Description (optional)"
            error={errors.description?.message}
          >
            <Textarea
              rows={3}
              placeholder="What this project is for."
              {...register('description', { setValueAs: emptyToUndefined })}
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={isSubmitting || create.isPending}>
            {isSubmitting || create.isPending ? <Spinner /> : null}
            Create project
          </Button>
        </form>
      </div>
    </main>
  );
}
