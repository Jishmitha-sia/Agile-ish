'use client';

export const dynamic = 'force-dynamic';

import { ConfirmPasswordResetRequest } from '@agile-ish/contracts';
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
import { useConfirmPasswordReset } from '../../../hooks/use-password-reset.js';
import { ApiError } from '../../../lib/api-error.js';

import type { ConfirmPasswordResetRequest as ConfirmType } from '@agile-ish/contracts';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const reset = useConfirmPasswordReset();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmType>({
    resolver: zodResolver(ConfirmPasswordResetRequest),
    defaultValues: { token, newPassword: '' },
    values: { token, newPassword: '' },
  });

  // No token → bounce them back to /forgot-password.
  useEffect(() => {
    if (!token) router.replace('/forgot-password');
  }, [token, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync(values);
      toast.success('Password reset. Please log in with your new password.');
      router.replace('/login');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (path === 'newPassword' || path === 'token') {
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
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your new password below. After resetting, all other sessions will be logged out.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <input type="hidden" {...register('token')} />
        <FormField
          id="newPassword"
          label="New password"
          helperText="At least 12 characters with upper, lower, and a digit."
          error={errors.newPassword?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••••••"
            {...register('newPassword')}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting || reset.isPending}>
          {isSubmitting || reset.isPending ? <Spinner /> : null}
          Reset password
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
