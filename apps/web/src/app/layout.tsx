import './globals.css';

import { Inter, JetBrains_Mono } from 'next/font/google';

import { RootProvider } from '../providers/root-provider.js';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';


const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Agile-ish',
    template: '%s · Agile-ish',
  },
  description: 'Open-source AI-native Scrum collaboration platform.',
  robots: { index: false, follow: false }, // flip on for the marketing site only
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f1117' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
