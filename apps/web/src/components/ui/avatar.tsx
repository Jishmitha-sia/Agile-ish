'use client';

import { cn } from '@agile-ish/ui';
import * as Primitive from '@radix-ui/react-avatar';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';


export const Avatar = forwardRef<
  ComponentRef<typeof Primitive.Root>,
  ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn(
      'relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full',
      className,
    )}
    {...props}
  />
));
Avatar.displayName = Primitive.Root.displayName;

export const AvatarImage = forwardRef<
  ComponentRef<typeof Primitive.Image>,
  ComponentPropsWithoutRef<typeof Primitive.Image>
>(({ className, ...props }, ref) => (
  <Primitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
));
AvatarImage.displayName = Primitive.Image.displayName;

export const AvatarFallback = forwardRef<
  ComponentRef<typeof Primitive.Fallback>,
  ComponentPropsWithoutRef<typeof Primitive.Fallback>
>(({ className, ...props }, ref) => (
  <Primitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = Primitive.Fallback.displayName;

/**
 * Derive a short, deterministic monogram from a display name.
 *
 *   "Ada Lovelace"  → "AL"
 *   "demo"          → "D"
 *   ""              → "?"
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
