'use client';

import { cn } from '@agile-ish/ui';
import { FolderKanban, Home, LayoutList, Plus, Settings, Zap, Users } from 'lucide-react';
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
    <aside className="border-border bg-card hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
      <div className="border-border border-b p-2">
        <WorkspaceSwitcher currentSlug={workspaceSlug} />
      </div>

      <nav
        className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3"
        aria-label="Workspace navigation"
      >
        <NavGroupLabel>Workspace</NavGroupLabel>
        <NavItem href={`/w/${workspaceSlug}`} icon={Home} label="Home" exact />
        <NavItem href={`/w/${workspaceSlug}/members`} icon={Users} label="Members" />
        <NavItem href={`/w/${workspaceSlug}/settings`} icon={Settings} label="Settings" />

        <div className="mt-4 flex items-center justify-between gap-2 pr-1">
          <NavGroupLabel>Projects</NavGroupLabel>
          {canCreateProject ? (
            <Link
              href={`/w/${workspaceSlug}/projects/new`}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1 transition-colors"
              aria-label="Create project"
              title="Create project"
            >
              <Plus className="size-3.5" />
            </Link>
          ) : null}
        </div>
        {projects && projects.length > 0 ? (
          <ul>
            {projects.map((p) => {
              const projectBase = `/w/${workspaceSlug}/projects/${p.slug}`;
              return (
                <li key={p.id}>
                  <NavItem
                    href={projectBase}
                    icon={FolderKanban}
                    label={p.name}
                    badge={p.identifierPrefix}
                    exact
                  />
                  <ProjectSubNav workspaceSlug={workspaceSlug} projectSlug={p.slug} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground/70 px-2 py-1 text-xs">
            {canCreateProject ? 'Create your first project.' : 'No projects yet.'}
          </p>
        )}
      </nav>

      <div className="border-border border-t p-2">
        <UserMenu />
      </div>
    </aside>
  );
}

function NavGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider">
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
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ProjectSubNav({
  workspaceSlug,
  projectSlug,
}: {
  workspaceSlug: string;
  projectSlug: string;
}) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}/projects/${projectSlug}`;
  if (!pathname.startsWith(base)) return null;

  return (
    <ul className="border-border ml-4 mt-0.5 space-y-0.5 border-l pl-2">
      <li>
        <SubNavItem href={`${base}/active-sprint`} icon={Zap} label="Active Sprint" />
      </li>
      <li>
        <SubNavItem href={`${base}/backlog`} icon={LayoutList} label="Backlog" />
      </li>
    </ul>
  );
}

function SubNavItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
