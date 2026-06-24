'use client';

export const dynamic = 'force-dynamic';

import { SignupRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, ShieldX } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '../../../components/ui/button.js';
import { FormField } from '../../../components/ui/form-field.js';
import { Input } from '../../../components/ui/input.js';
import { Spinner } from '../../../components/ui/spinner.js';
import { useSignup } from '../../../hooks/use-auth.js';
import { useAcceptInvitation, useInvitationLookup } from '../../../hooks/use-invitations.js';
import { ApiError } from '../../../lib/api-error.js';
import { useAuthStore } from '../../../stores/auth.store.js';

import type {
  InvitationLookupResponse,
  SignupRequest as SignupRequestType,
} from '@agile-ish/contracts';

/**
 * Accept-invite landing page.
 *
 * Three states:
 *   1. **Unauthed** — show invitation details + inline signup form. The
 *      email is locked to the invitation address. On submit: signup
 *      creates the user (and their default personal workspace), then we
 *      immediately call accept to add them to the invited workspace.
 *   2. **Authed, email matches** — show "Accept" button. One click adds
 *      the membership and redirects into the workspace.
 *   3. **Authed, email mismatch** — show a "wrong account" message with
 *      a Log out link so the user can switch identities.
 *
 * Lookup errors (invalid / expired / revoked token) surface as a
 * standalone "this link doesn't work" view.
 */
export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token);
  const lookup = useInvitationLookup(token);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {lookup.isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner className="text-muted-foreground size-6" />
          </div>
        ) : lookup.error || !lookup.data ? (
          <InvalidInvitation error={lookup.error} />
        ) : status === 'initializing' ? (
          <div className="grid place-items-center py-16">
            <Spinner className="text-muted-foreground size-6" />
          </div>
        ) : status === 'authenticated' && user ? (
          user.email.toLowerCase() === lookup.data.email.toLowerCase() ? (
            <AcceptForAuthed token={token} invitation={lookup.data} />
          ) : (
            <EmailMismatch
              expectedEmail={lookup.data.email}
              currentEmail={user.email}
              token={token}
            />
          )
        ) : (
          <AcceptForGuest token={token} invitation={lookup.data} />
        )}
      </div>
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: InvitationLookupResponse }) {
  return (
    <div className="border-border bg-card space-y-2 rounded-lg border p-5">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        Workspace invitation
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Join {invitation.workspace.name}</h1>
      <p className="text-muted-foreground text-sm">
        {invitation.inviterDisplayName
          ? `${invitation.inviterDisplayName} invited you`
          : "You've been invited"}{' '}
        to join as a{' '}
        <span className="text-foreground font-medium">{invitation.role.toLowerCase()}</span>.
      </p>
      <p className="text-muted-foreground text-xs">
        Invitation sent to <span className="font-mono">{invitation.email}</span>.
      </p>
    </div>
  );
}

function AcceptForAuthed({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationLookupResponse;
}) {
  const router = useRouter();
  const accept = useAcceptInvitation();
  const [hasAttempted, setHasAttempted] = useState(false);

  const onAccept = async () => {
    setHasAttempted(true);
    try {
      const result = await accept.mutateAsync(token);
      toast.success(`Joined ${result.workspace.name}`);
      router.replace(`/w/${result.workspace.slug}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not accept the invitation.');
    }
  };

  return (
    <div className="space-y-5">
      <InvitationCard invitation={invitation} />
      <div className="flex gap-2">
        <Button
          onClick={() => void onAccept()}
          disabled={accept.isPending || hasAttempted}
          className="flex-1"
        >
          {accept.isPending ? <Spinner /> : <CheckCircle2 />}
          Accept and join
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Not now</Link>
        </Button>
      </div>
    </div>
  );
}

function EmailMismatch({
  expectedEmail,
  currentEmail,
  token,
}: {
  expectedEmail: string;
  currentEmail: string;
  token: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2">
        <ShieldX className="size-5 text-amber-400" />
        <h1 className="text-base font-semibold">Wrong account</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        This invitation was sent to{' '}
        <span className="text-foreground font-mono">{expectedEmail}</span>, but you&apos;re signed
        in as <span className="text-foreground font-mono">{currentEmail}</span>. Log out and sign in
        (or sign up) with the invited email to accept.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/login?next=${encodeURIComponent(`/invite/${encodeURIComponent(token)}`)}`}>
            Log in as a different user
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AcceptForGuest({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationLookupResponse;
}) {
  const router = useRouter();
  const signup = useSignup();
  const accept = useAcceptInvitation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequestType>({
    resolver: zodResolver(SignupRequest),
    defaultValues: {
      email: invitation.email,
      password: '',
      displayName: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Force the email to the invitation's (the form field is disabled
      // but a malicious caller could still try to override it).
      await signup.mutateAsync({
        email: invitation.email,
        password: values.password,
        displayName: values.displayName,
      });
      const result = await accept.mutateAsync(token);
      toast.success(`Welcome to ${result.workspace.name}`);
      router.replace(`/w/${result.workspace.slug}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (path === 'displayName' || path === 'password') {
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
        toast.error('Something went wrong. Please try again.');
      }
    }
  });

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${encodeURIComponent(token)}`)}`;

  return (
    <div className="space-y-5">
      <InvitationCard invitation={invitation} />
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormField id="displayName" label="Display name" error={errors.displayName?.message}>
          <Input
            autoFocus
            autoComplete="name"
            placeholder="Ada Lovelace"
            {...register('displayName')}
          />
        </FormField>
        <FormField id="email" label="Email">
          <Input value={invitation.email} disabled readOnly />
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
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || signup.isPending || accept.isPending}
        >
          {isSubmitting || signup.isPending || accept.isPending ? <Spinner /> : null}
          Create account and join
        </Button>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href={loginHref} className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function InvalidInvitation({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'This invitation link is invalid, has been revoked, or has expired.';
  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-4 rounded-lg border p-5 text-center">
      <div className="bg-destructive/15 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
        <ShieldX className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-base font-semibold">Invitation unavailable</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
