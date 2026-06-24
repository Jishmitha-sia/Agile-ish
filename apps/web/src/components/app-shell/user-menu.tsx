'use client';

import { cn } from '@agile-ish/ui';
import { LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useLogout } from '../../hooks/use-auth.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

/**
 * Sidebar user menu — bottom of the rail. Avatar + name trigger a
 * dropdown with account links and logout.
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      router.replace('/login');
    } catch {
      toast.error('Could not log out cleanly. Please refresh.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2',
          collapsed && 'justify-center',
        )}
        aria-label="Open user menu"
      >
        <Avatar>
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initialsOf(user.displayName)}</AvatarFallback>
        </Avatar>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-tight">{user.displayName}</div>
            <div className="text-muted-foreground truncate text-xs">{user.email}</div>
          </div>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex w-full items-center gap-2">
            <User className="size-4" />
            <span>Account</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/preferences" className="flex w-full items-center gap-2">
            <Settings className="size-4" />
            <span>Preferences</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void handleLogout();
          }}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
