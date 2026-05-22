import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with Tailwind-aware conflict resolution.
 * Idiomatic shadcn helper — used by every styled component.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
