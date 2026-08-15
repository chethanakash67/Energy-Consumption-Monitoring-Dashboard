'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '@/components/layout/BrandMark';

/**
 * Entry route. Sends signed-in users to the dashboard and everyone else to
 * login, showing the brand mark while the session check resolves.
 */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-fade-in">
        <BrandMark size="lg" />
      </div>
    </div>
  );
}
