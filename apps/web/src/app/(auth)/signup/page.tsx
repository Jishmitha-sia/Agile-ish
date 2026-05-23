'use client';

export const dynamic = 'force-dynamic';

import { SignupRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button.js';
import { FormField } from '../../../components/ui/form-field.js';
import { Input } from '../../../components/ui/input.js';
import { Spinner } from '../../../components/ui/spinner.js';
import { useSignup } from '../../../hooks/use-auth.js';
import { ApiError } from '../../../lib/api-error.js';
import { useAuthStore } from '../../../stores/auth.store.js';

import type { SignupRequest as SignupRequestType } from '@agile-ish/contracts';

type SignupKey = keyof SignupRequestType;
const SIGNUP_KEYS: ReadonlySet<SignupKey> = new Set([
  'email',
  'password',
  'displayName',
  'workspaceName',
]);

export default function SignupPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const signup = useSignup();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequestType>({
    resolver: zodResolver(SignupRequest),
    defaultValues: { email: '', password: '', displayName: '', workspaceName: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Send an undefined workspaceName when blank so the server applies its default.
      const payload: SignupRequestType = {
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        ...(values.workspaceName ? { workspaceName: values.workspaceName } : {}),
      };
      await signup.mutateAsync(payload);
      toast.success('Welcome to Agile-ish');
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (SIGNUP_KEYS.has(path as SignupKey)) {
              setError(path as SignupKey, { type: 'server', message: issue.message });
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll spin up a personal workspace you can rename later.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormField id="displayName" label="Display name" error={errors.displayName?.message}>
          <Input autoFocus autoComplete="name" placeholder="Ada Lovelace" {...register('displayName')} />
        </FormField>

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          helperText="At least 12 characters with upper, lower, and a digit."
          error={errors.password?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            {...register('password')}
          />
        </FormField>

        <FormField
          id="workspaceName"
          label="Workspace name (optional)"
          helperText="Defaults to “Your Name's Workspace”."
          error={errors.workspaceName?.message}
        >
          <Input placeholder="Acme Engineering" {...register('workspaceName')} />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting || signup.isPending}>
          {isSubmitting || signup.isPending ? <Spinner /> : null}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
