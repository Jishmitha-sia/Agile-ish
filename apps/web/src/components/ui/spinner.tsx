import { Loader2 } from 'lucide-react';

import { cn } from '@agile-ish/ui';

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('animate-spin', className)} aria-hidden />
);
