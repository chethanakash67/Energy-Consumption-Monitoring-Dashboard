'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { BrandMark } from './BrandMark';
import {
  IconAlerts,
  IconAnalytics,
  IconDashboard,
  IconDevices,
  IconLogout,
  IconSettings,
} from './Icons';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { cn } from '@/lib/utils';
import type { AlertsResponse } from '@/lib/types';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { href: '/analytics', label: 'Analytics', Icon: IconAnalytics },
  { href: '/devices', label: 'Devices', Icon: IconDevices },
  { href: '/alerts', label: 'Alerts', Icon: IconAlerts, badge: 'alerts' as const },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { status } = useLive();

  // Drives the unread count on the Alerts nav item. Revalidated by the SSE
  // layer whenever an alert arrives or is acknowledged.
  const { data } = useSWR<AlertsResponse>('/api/alerts?source=realtime&status=open&limit=1');
  const openAlerts = data?.openCounts.total ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" onClick={onNavigate}>
          <BrandMark size="sm" />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          // `startsWith` so /devices/:id keeps the Devices item active.
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
                'transition-all duration-200 ease-smooth',
                active
                  ? 'bg-brand-subtle text-brand shadow-glow-brand-sm'
                  : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink',
              )}
            >
              {/* Active rail — a 2px glowing marker rather than a full-bleed fill. */}
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-brand shadow-[0_0_8px_1px_var(--glow-brand)] transition-all duration-200 ease-smooth',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 truncate">{label}</span>

              {badge === 'alerts' && openAlerts > 0 ? (
                <span className="rounded-full bg-critical px-1.5 py-0.5 text-2xs font-semibold leading-none text-white tnum">
                  {openAlerts > 99 ? '99+' : openAlerts}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        {/* Stream status — the single place the user can confirm live data. */}
        <div
          className={cn(
            'mb-2 flex items-center gap-2 rounded-md bg-surface-subtle px-2.5 py-2 transition-shadow duration-500',
            status === 'live' && 'shadow-glow-optimal-sm',
          )}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {status === 'live' ? (
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-optimal opacity-75" />
            ) : null}
            <span
              className={cn(
                'relative inline-flex h-1.5 w-1.5 rounded-full',
                status === 'live' && 'bg-optimal shadow-[0_0_6px_1px_var(--glow-optimal)]',
                status === 'connecting' && 'bg-elevated',
                status === 'offline' && 'bg-critical',
              )}
            />
          </span>
          <span className="text-2xs font-medium text-ink-secondary">
            {status === 'live'
              ? 'Live data streaming'
              : status === 'connecting'
                ? 'Connecting…'
                : 'Stream offline'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white shadow-glow-brand-sm"
            style={{
              background: 'linear-gradient(140deg, var(--series-1), var(--series-5))',
            }}
          >
            {initials(user?.name ?? '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{user?.name}</p>
            <p className="truncate text-2xs capitalize text-ink-muted">
              {user?.role.toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-critical"
          >
            <IconLogout className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
