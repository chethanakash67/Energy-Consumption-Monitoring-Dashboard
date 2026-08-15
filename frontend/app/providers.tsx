'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/lib/toast';
import { fetcher } from '@/lib/api';
import { Toaster } from '@/components/ui/Toaster';

/**
 * Client provider stack.
 *
 * Order matters: Theme is outermost because Auth applies the signed-in user's
 * saved theme preference, and Toast must wrap anything that raises a toast.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        // Charts share cache keys across pages; a short dedupe window keeps
        // navigation from refetching identical ranges.
        dedupingInterval: 4000,
      }}
    >
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}
