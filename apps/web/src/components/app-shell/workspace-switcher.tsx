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
        className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2"
        aria-label="Switch workspace"
      >
        <Avatar className="h-7 w-7 rounded-md">
          <AvatarFallback className="bg-primary/15 text-primary rounded-md text-[10px] font-semibold">
            {initialsOf(current?.workspaceName ?? currentSlug)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">
            {current?.workspaceName ?? currentSlug}
          </div>
          <div className="text-muted-foreground truncate text-[11px] uppercase tracking-wide">
            {current?.role.toLowerCase() ?? 'member'}
          </div>
        </div>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => {
          const isActive = m.workspaceSlug === currentSlug;
          return (
            <DropdownMenuItem key={m.workspaceId} asChild>
              <Link href={`/w/${m.workspaceSlug}`} className="flex w-full items-center gap-2">
                <Avatar className="h-6 w-6 rounded">
                  <AvatarFallback className="bg-primary/15 text-primary rounded text-[10px] font-semibold">
                    {initialsOf(m.workspaceName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{m.workspaceName}</div>
                  <div className="text-muted-foreground truncate text-[11px] uppercase tracking-wide">
                    {m.role.toLowerCase()}
                  </div>
                </div>
                {isActive ? <Check className="text-primary size-4 shrink-0" /> : null}
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
