import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { themeInitScript } from '@/lib/theme';

/** UI face — used for everything except large numeric displays. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * Numeric display face. Its wider, more geometric figures give KPI values a
 * distinct texture from the UI text without changing the overall voice.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-numeric',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Voltiq — Energy Monitoring',
    template: '%s · Voltiq',
  },
  description:
    'Monitor, analyse, and manage energy consumption across every device and location in real time.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c10' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-canvas antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
