'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

import type { ReactNode } from 'react';

/**
 * Wraps `next-themes` with our token defaults.
 *
 * `attribute="data-theme"` matches the CSS-variable scope set up in
 * @agile-ish/ui/styles.css — toggling theme just changes the data
 * attribute, no className gymnastics.
 *
 * `disableTransitionOnChange` prevents Tailwind's transition utilities
 * from animating the theme switch (which looks janky on every colour).
 */
export const ThemeProvider = ({
  children,
  ...props
}: { children: ReactNode } & Omit<ThemeProviderProps, 'children'>) => (
  <NextThemesProvider
    attribute="data-theme"
    defaultTheme="dark"
    enableSystem
    disableTransitionOnChange
    {...props}
  >
    {children}
  </NextThemesProvider>
);
