'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '../../stores/auth.store.js';
import { Avatar, AvatarFallback, initialsOf } from '../ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

/**
 * Sidebar workspace switcher.
 *
 * Source of truth is the auth store's `user.memberships` — populated by
 * `/auth/me` on bootstrap and refreshed by every workspace mutation. We
 * deliberately don't ship a parallel React Query cache for the
 * membership list; the auth store already has it.
 */
export function WorkspaceSwitcher({ currentSlug }: { currentSlug: string }) {
  const user = useAuthStore((s) => s.user);
  const memberships = user?.memberships ?? [];
  const current = memberships.find((m) => m.workspaceSlug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Switch workspace"
      >
        <Avatar className="h-7 w-7 rounded-md">
          <AvatarFallback className="rounded-md bg-primary/15 text-[10px] font-semibold text-primary">
            {initialsOf(current?.workspaceName ?? currentSlug)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">
            {current?.workspaceName ?? currentSlug}
          </div>
          <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {current?.role.toLowerCase() ?? 'member'}
          </div>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => {
          const isActive = m.workspaceSlug === currentSlug;
          return (
            <DropdownMenuItem key={m.workspaceId} asChild>
              <Link
                href={`/w/${m.workspaceSlug}`}
                className="flex w-full items-center gap-2"
              >
                <Avatar className="h-6 w-6 rounded">
                  <AvatarFallback className="rounded bg-primary/15 text-[10px] font-semibold text-primary">
                    {initialsOf(m.workspaceName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{m.workspaceName}</div>
                  <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                    {m.role.toLowerCase()}
                  </div>
                </div>
                {isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces/new" className="flex w-full items-center gap-2">
            <Plus className="size-4" />
            <span>Create workspace</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
