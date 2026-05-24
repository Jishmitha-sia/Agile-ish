'use client';

import { cn } from '@agile-ish/ui';
import { FolderKanban, Home, Plus, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, type ReactNode } from 'react';

import { useProjects } from '../../hooks/use-projects.js';
import { useAuthStore } from '../../stores/auth.store.js';

import { UserMenu } from './user-menu.js';
import { WorkspaceSwitcher } from './workspace-switcher.js';

/**
 * Left rail of the app shell.
 *
 * Composition:
 *   • Workspace switcher at the top (current workspace + dropdown).
 *   • Workspace-scoped nav items (Home, Members, Settings).
 *   • Projects list — current workspace's projects, ADMIN+ gets a "+ New" button.
 *   • User menu at the bottom (avatar + logout).
 *
 * The rail is fixed-width on desktop. Mobile responsive shell lives
 * outside this file; this component just renders the column contents.
 */
export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canCreateProject = membership
    ? membership.role === 'OWNER' || membership.role === 'ADMIN'
    : false;
  const { data: projects } = useProjects(workspaceSlug);

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="border-b border-border p-2">
        <WorkspaceSwitcher currentSlug={workspaceSlug} />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Workspace navigation">
        <NavGroupLabel>Workspace</NavGroupLabel>
        <NavItem href={`/w/${workspaceSlug}`} icon={Home} label="Home" exact />
        <NavItem href={`/w/${workspaceSlug}/members`} icon={Users} label="Members" />
        <NavItem href={`/w/${workspaceSlug}/settings`} icon={Settings} label="Settings" />

        <div className="mt-4 flex items-center justify-between gap-2 pr-1">
          <NavGroupLabel>Projects</NavGroupLabel>
          {canCreateProject ? (
            <Link
              href={`/w/${workspaceSlug}/projects/new`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Create project"
              title="Create project"
            >
              <Plus className="size-3.5" />
            </Link>
          ) : null}
        </div>
        {projects && projects.length > 0 ? (
          <ul>
            {projects.map((p) => (
              <li key={p.id}>
                <NavItem
                  href={`/w/${workspaceSlug}/projects/${p.slug}`}
                  icon={FolderKanban}
                  label={p.name}
                  badge={p.identifierPrefix}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground/70">
            {canCreateProject ? 'Create your first project.' : 'No projects yet.'}
          </p>
        )}
      </nav>

      <div className="border-t border-border p-2">
        <UserMenu />
      </div>
    </aside>
  );
}

function NavGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  exact = false,
  badge,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
  badge?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
