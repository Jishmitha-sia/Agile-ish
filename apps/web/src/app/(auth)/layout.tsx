import Link from 'next/link';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center px-6">
        <Link
          href="/"
          className="text-foreground/80 hover:text-foreground font-mono text-sm font-semibold tracking-tight transition-colors"
        >
          agile-ish
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="animate-fade-in w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
