import Link from 'next/link';

import { Button } from '../components/ui/button.js';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          The link is broken, or you don&apos;t have access to this resource.
        </p>
        <Button asChild className="w-full">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
