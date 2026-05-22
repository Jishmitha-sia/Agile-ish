'use client';

import { useAuthStore } from '../../stores/auth.store.js';

/**
 * Phase 1 landing page — confirms the auth flow is working end-to-end.
 * Phase 2 replaces this with the workspace dashboard (projects, sprints,
 * recent activity).
 */
export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const memberships = user?.memberships ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}.
        </h1>
        <p className="text-muted-foreground">
          You&apos;re signed in. The Phase-1 foundation is working — auth flow, refresh
          rotation, RBAC, and audit logging are live.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your workspaces
        </h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memberships.map((m) => (
              <li key={m.workspaceId} className="flex items-center justify-between py-2">
                <span className="font-mono text-sm">{m.workspaceSlug}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-sm text-muted-foreground">
        Phase 2 will add the workspace dashboard, projects, members management, and
        the keyboard-first shell. This page exists so the Phase-1 deliverable is
        end-to-end testable.
      </section>
    </div>
  );
}
