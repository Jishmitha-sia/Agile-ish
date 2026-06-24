'use client';

import { Check, UserCircle2, UserX } from 'lucide-react';

import { useMembers } from '../../hooks/use-members.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

import type { UserId } from '@agile-ish/contracts';

interface Assignee {
  id: UserId;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Workspace-member picker. Renders the current assignee (or "Unassigned"),
 * opens a dropdown of all workspace members on click, including an explicit
 * "Unassigned" entry. Keeps assignment a one-click operation.
 */
export function AssigneePicker({
  workspaceSlug,
  value,
  onChange,
  disabled = false,
}: {
  workspaceSlug: string;
  value: Assignee | null;
  onChange: (next: UserId | null) => void;
  disabled?: boolean;
}) {
  const { data: members } = useMembers(workspaceSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="hover:bg-accent flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {value ? (
          <>
            <Avatar className="size-5">
              {value.avatarUrl ? <AvatarImage src={value.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[9px]">
                {initialsOf(value.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{value.displayName}</span>
          </>
        ) : (
          <>
            <UserCircle2 className="text-muted-foreground size-5" />
            <span className="text-muted-foreground">Unassigned</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Assignee</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <UserX className="size-4" />
          <span>Unassigned</span>
          {value === null ? <Check className="text-primary ml-auto size-4" /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(members ?? []).map((m) => {
          const isActive = value?.id === m.userId;
          return (
            <DropdownMenuItem
              key={m.userId}
              onSelect={() => onChange(m.userId)}
              className="flex items-center gap-2"
            >
              <Avatar className="size-5">
                {m.user.avatarUrl ? <AvatarImage src={m.user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[9px]">
                  {initialsOf(m.user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.user.displayName}</div>
                <div className="text-muted-foreground truncate text-[11px]">{m.user.email}</div>
              </div>
              {isActive ? <Check className="text-primary size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
