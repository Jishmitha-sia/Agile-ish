'use client';

export const dynamic = 'force-dynamic';

import { RequestPasswordResetRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/button.js';
import { FormField } from '../../../components/ui/form-field.js';
import { Input } from '../../../components/ui/input.js';
import { Spinner } from '../../../components/ui/spinner.js';
import { useRequestPasswordReset } from '../../../hooks/use-password-reset.js';

import type { RequestPasswordResetRequest as RequestType } from '@agile-ish/contracts';

export default function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestType>({
    resolver: zodResolver(RequestPasswordResetRequest),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await requestReset.mutateAsync(values);
  });

  // Generic "if-an-account-exists" success message — never leak whether
  // the email is registered.
  if (requestReset.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a password-reset link.
          It expires in 60 minutes.
        </p>
        <p className="pt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset it.
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

        <Button type="submit" className="w-full" disabled={isSubmitting || requestReset.isPending}>
          {isSubmitting || requestReset.isPending ? <Spinner /> : null}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
