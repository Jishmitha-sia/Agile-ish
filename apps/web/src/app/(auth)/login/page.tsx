'use client';

// Auth pages read cookies + useSearchParams — no point prerendering.
export const dynamic = 'force-dynamic';

import { LoginRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button.js';
import { FormField } from '../../../components/ui/form-field.js';
import { Input } from '../../../components/ui/input.js';
import { Spinner } from '../../../components/ui/spinner.js';
import { useLogin } from '../../../hooks/use-auth.js';
import { ApiError } from '../../../lib/api-error.js';
import { useAuthStore } from '../../../stores/auth.store.js';

import type { LoginRequest as LoginRequestType } from '@agile-ish/contracts';

export default function LoginPage() {
  // `useSearchParams` must be wrapped in <Suspense> at the page boundary for
  // the build's prerender pass — otherwise Next bails out with an error.
  return (
    <Suspense fallback={<div className="h-64" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const status = useAuthStore((s) => s.status);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequestType>({
    resolver: zodResolver(LoginRequest),
    defaultValues: { email: '', password: '' },
  });

  // If the bootstrap refresh succeeds (e.g. browser back to /login after
  // a successful login in another tab), redirect away from the auth page.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      toast.success('Welcome back');
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        // 422: per-field issues from Zod on the server
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (path === 'email' || path === 'password') {
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Sign in to your workspace.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            {...register('email')}
          />
        </FormField>

        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            {...register('password')}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting || login.isPending}>
          {isSubmitting || login.isPending ? <Spinner /> : null}
          Log in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
