'use client';

import { cn } from '@agile-ish/ui';
import { Home, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, type ReactNode } from 'react';

import { UserMenu } from './user-menu.js';
import { WorkspaceSwitcher } from './workspace-switcher.js';

/**
 * Left rail of the app shell.
 *
 * Composition:
 *   • Workspace switcher at the top (current workspace + dropdown).
 *   • Workspace-scoped nav items (Home, Members, Settings).
 *   • User menu at the bottom (avatar + logout).
 *
 * The rail is fixed-width on desktop. Mobile responsive shell lives
 * outside this file; this component just renders the column contents.
 */
export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
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
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
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
      <span className="truncate">{label}</span>
    </Link>
  );
}
