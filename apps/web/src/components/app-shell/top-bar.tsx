'use client';

import { cn } from '@agile-ish/ui';
import { type ReactNode } from 'react';

/**
 * Top bar of the app shell — page title on the left, slot for actions
 * on the right (search trigger, breadcrumbs, etc.).
 *
 * Keep this dumb: the page chooses what to put here. Don't pull data
 * inside — that's the page's job.
 */
export function TopBar({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'border-border bg-background/95 supports-[backdrop-filter]:bg-background/70 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6 backdrop-blur',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground truncate text-xs">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
