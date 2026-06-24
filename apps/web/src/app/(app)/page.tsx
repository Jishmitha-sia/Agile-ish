'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '../../components/ui/spinner.js';
import { useAuthStore } from '../../stores/auth.store.js';

/**
 * Authenticated root — picks the right destination based on the user's
 * memberships and redirects.
 *
 *   • Has a defaultWorkspaceId that resolves to a current membership
 *     → /w/{thatSlug}
 *   • Otherwise falls back to the first membership
 *     → /w/{firstSlug}
 *   • No memberships at all (shouldn't happen post-signup, but possible
 *     if the user was removed from every workspace they were in)
 *     → /workspaces/new
 *
 * Rendered only while we figure out where to send the user — the
 * (app)/layout above us guarantees `status === 'authenticated'`.
 */
export default function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const memberships = user.memberships;
    const target =
      memberships.find((m) => m.workspaceId === user.defaultWorkspaceId) ?? memberships[0];
    if (target) {
      router.replace(`/w/${target.workspaceSlug}`);
    } else {
      router.replace('/workspaces/new');
    }
  }, [user, router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="text-muted-foreground size-6" />
    </div>
  );
}
