'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { SidebarContent } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { BrandMark } from './BrandMark';
import { IconMenu } from './Icons';
import { LiveTicker } from './LiveTicker';
import { AmbientBackground } from './AmbientBackground';
import { cn } from '@/lib/utils';

/**
 * Authenticated chrome: a fixed sidebar on desktop that becomes an overlay
 * drawer below `lg`, plus a sticky header carrying the page title and the
 * live ticker.
 */
export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation and lock scroll while it's open.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen">
      <AmbientBackground />

      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'glass-strong absolute inset-y-0 left-0 w-64 shadow-pop',
            'transition-transform duration-300 ease-smooth',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="lg:pl-60">
        <header className="glass sticky top-0 z-20">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink lg:hidden"
            >
              <IconMenu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="lg:hidden">
                <BrandMark size="sm" showWordmark={false} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-ink">
                  {title}
                </h1>
                {description ? (
                  <p className="hidden truncate text-xs text-ink-muted sm:block">{description}</p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <LiveTicker className="hidden md:flex" />
              {actions}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
