'use client';

import { useLive } from '@/lib/live';
import { formatPower } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Compact current-demand readout for the header.
 *
 * Deliberately shows kW (instantaneous power), not kWh — the KPI cards below
 * cover accumulated energy, and conflating the two is the classic energy-
 * dashboard mistake.
 */
export function LiveTicker({ className }: { className?: string }) {
  const { latest, status } = useLive();

  if (status !== 'live' || !latest) {
    return (
      <div className={cn('glass items-center gap-2 rounded-md px-2.5 py-1.5', className)}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
        <span className="text-xs text-ink-muted">
          {status === 'connecting' ? 'Connecting…' : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'glass items-center gap-2 rounded-md px-2.5 py-1.5 shadow-glow-optimal-sm',
        className,
      )}
      title="Current total demand across all devices"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-optimal opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-optimal shadow-[0_0_6px_1px_var(--glow-optimal)]" />
      </span>
      <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Now</span>
      <span className="font-numeric text-sm font-semibold tabular-nums text-ink">
        {formatPower(latest.totalKw)}
      </span>
    </div>
  );
}
