'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { LiveProvider } from '@/lib/live';
import { BrandMark } from '@/components/layout/BrandMark';

/**
 * Route guard for everything behind auth.
 *
 * Renders nothing but the brand mark until the session resolves, so protected
 * content never flashes before the redirect.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">
          <BrandMark size="lg" showWordmark={false} />
        </div>
      </div>
    );
  }

  // Mounted here (not in the root layout) so the SSE stream only opens for
  // authenticated users and stays open across route changes.
  return <LiveProvider>{children}</LiveProvider>;
}
