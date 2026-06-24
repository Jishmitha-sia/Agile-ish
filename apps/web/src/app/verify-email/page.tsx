'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { Button } from '../../components/ui/button.js';
import { Spinner } from '../../components/ui/spinner.js';
import { useConfirmEmailVerification } from '../../hooks/use-email-verification.js';

/**
 * Auto-confirms the verification token on mount and shows the outcome.
 * Lives outside the (auth) group because it isn't a form — it's a
 * confirmation landing page following a click from the verification email.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner className="size-6" />}>
      <VerifyEmailFlow />
    </Suspense>
  );
}

function VerifyEmailFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const confirm = useConfirmEmailVerification();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !token) return;
    fired.current = true;
    confirm.mutate({ token });
  }, [token, confirm]);

  if (!token) {
    return (
      <Card
        heading="Missing token"
        body="This page expects a ?token=… query parameter from your verification email."
      >
        <Button asChild className="w-full">
          <Link href="/login">Back to log in</Link>
        </Button>
      </Card>
    );
  }

  if (confirm.isPending || (confirm.isIdle && token)) {
    return (
      <Card heading="Verifying your email…" body="One moment.">
        <Spinner className="text-muted-foreground mx-auto size-5" />
      </Card>
    );
  }

  if (confirm.isSuccess) {
    return (
      <Card heading="Email verified" body="Your email is confirmed. You can now log in.">
        <Button onClick={() => router.replace('/login')} className="w-full">
          Continue to log in
        </Button>
      </Card>
    );
  }

  // Failure (expired / invalid / used). The server distinguishes via HTTP status;
  // we surface a single friendly message and offer a re-request path.
  return (
    <Card
      heading="Link no longer valid"
      body="This verification link has expired or already been used. Log in and request a new one from your account settings."
    >
      <Button asChild className="w-full">
        <Link href="/login">Back to log in</Link>
      </Button>
    </Card>
  );
}

function Card({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}
