'use client';

import { type SearchResult } from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import { Command } from 'cmdk';
import { FolderKanban, Hash, Loader2, Search, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useSearch } from '../../hooks/use-search.js';

interface Props {
  workspaceSlug: string;
}

export function CommandPalette({ workspaceSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const { data: searchData, isFetching } = useSearch(workspaceSlug, query);
  const results = searchData?.results ?? [];

  // Toggle on Ctrl+K / Cmd+K; also close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');
      if (result.kind === 'issue') {
        router.push(
          `/w/${workspaceSlug}/projects/${result.projectSlug}/issues/${result.identifier.split('-')[1]}`,
        );
      } else if (result.kind === 'project') {
        router.push(`/w/${workspaceSlug}/projects/${result.slug}`);
      }
      // members don't have a dedicated page yet
    },
    [router, workspaceSlug],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="bg-background/60 fixed inset-0 z-40 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery('');
        }}
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[20vh] z-50 mx-auto max-w-xl px-4">
        <Command
          className="border-border bg-card overflow-hidden rounded-xl border shadow-2xl"
          shouldFilter={false}
        >
          {/* Input */}
          <div className="border-border flex items-center gap-3 border-b px-4 py-3">
            {isFetching ? (
              <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
            ) : (
              <Search className="text-muted-foreground size-4 shrink-0" />
            )}
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search issues, projects, members…"
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
            <kbd className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[50vh] overflow-y-auto py-2">
            {query.trim().length === 0 && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                Type to search issues, projects, or members…
              </div>
            )}

            {query.trim().length > 0 && results.length === 0 && !isFetching && (
              <Command.Empty className="text-muted-foreground px-4 py-8 text-center text-sm">
                No results for &ldquo;{query}&rdquo;
              </Command.Empty>
            )}

            {/* Issues group */}
            {results.filter((r) => r.kind === 'issue').length > 0 && (
              <Command.Group
                heading={
                  <span className="text-muted-foreground px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    Issues
                  </span>
                }
              >
                {results
                  .filter((r): r is Extract<SearchResult, { kind: 'issue' }> => r.kind === 'issue')
                  .map((r) => (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => handleSelect(r)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                        'hover:bg-accent transition-colors',
                        'data-[selected=true]:bg-accent',
                      )}
                    >
                      <Hash className="text-muted-foreground size-4 shrink-0" />
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {r.identifier}
                      </span>
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {r.status.replace('_', ' ')}
                      </span>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {/* Projects group */}
            {results.filter((r) => r.kind === 'project').length > 0 && (
              <Command.Group
                heading={
                  <span className="text-muted-foreground px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    Projects
                  </span>
                }
              >
                {results
                  .filter(
                    (r): r is Extract<SearchResult, { kind: 'project' }> => r.kind === 'project',
                  )
                  .map((r) => (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => handleSelect(r)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                        'hover:bg-accent transition-colors',
                        'data-[selected=true]:bg-accent',
                      )}
                    >
                      <FolderKanban className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {r.identifierPrefix}
                      </span>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {/* Members group */}
            {results.filter((r) => r.kind === 'member').length > 0 && (
              <Command.Group
                heading={
                  <span className="text-muted-foreground px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    Members
                  </span>
                }
              >
                {results
                  .filter(
                    (r): r is Extract<SearchResult, { kind: 'member' }> => r.kind === 'member',
                  )
                  .map((r) => (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => handleSelect(r)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                        'hover:bg-accent transition-colors',
                        'data-[selected=true]:bg-accent',
                      )}
                    >
                      <User className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex-1 truncate">{r.displayName}</span>
                      <span className="text-muted-foreground truncate text-xs">{r.email}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="border-border text-muted-foreground flex items-center gap-4 border-t px-4 py-2.5 text-[11px]">
            <span>
              <kbd className="border-border bg-muted rounded border px-1 py-0.5">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="border-border bg-muted rounded border px-1 py-0.5">↵</kbd> open
            </span>
            <span>
              <kbd className="border-border bg-muted rounded border px-1 py-0.5">Esc</kbd> close
            </span>
          </div>
        </Command>
      </div>
    </>
  );
}
