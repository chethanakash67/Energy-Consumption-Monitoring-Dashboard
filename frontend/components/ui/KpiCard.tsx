'use client';

import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';

interface KpiCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  icon?: ReactNode;
  /** Percentage change vs the previous period. */
  change?: number;
  /**
   * Whether a rising number is good. Energy use going *down* is good, so most
   * cards pass "down" — this decides which tone the delta chip wears.
   */
  goodDirection?: 'up' | 'down' | 'neutral';
  /** Small caption under the value, e.g. "vs previous 7 days". */
  caption?: ReactNode;
  /** Optional inline sparkline or mini-visual. */
  visual?: ReactNode;
  className?: string;
}

export function KpiCard({
  label,
  value,
  format,
  icon,
  change,
  goodDirection = 'down',
  caption,
  visual,
  className,
}: KpiCardProps) {
  const hasChange = change !== undefined && Number.isFinite(change);
  const rising = (change ?? 0) > 0;

  // Below this the change is noise, not signal — render it neutral.
  const isFlat = hasChange && Math.abs(change!) < 0.05;

  const tone =
    !hasChange || isFlat || goodDirection === 'neutral'
      ? 'neutral'
      : (rising && goodDirection === 'up') || (!rising && goodDirection === 'down')
        ? 'good'
        : 'bad';

  return (
    <div
      className={cn(
        'group glass glass-edge relative overflow-hidden rounded-lg p-4 shadow-xs',
        'transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-glow-brand sm:p-5',
        className,
      )}
    >
      {/* Radial bloom that fades in behind the value on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle, var(--glow-brand), transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-ink-muted transition-all duration-200 group-hover:bg-brand-subtle group-hover:text-brand group-hover:shadow-glow-brand-sm">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <AnimatedNumber
          value={value}
          format={format}
          className="font-numeric text-3xl font-semibold leading-none tracking-tight text-ink"
        />
        {visual ? <div className="shrink-0 pb-0.5">{visual}</div> : null}
      </div>

      {/* Gradient underline — sweeps once the value has landed, echoing a
          current running through the card. */}
      <div
        aria-hidden
        className="glow-sweep relative mt-2 h-[2px] w-full rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--brand) 0%, var(--glow-brand) 50%, transparent 100%)',
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasChange ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold tnum',
              tone === 'good' && 'bg-optimal-subtle text-optimal-fg',
              tone === 'bad' && 'bg-critical-subtle text-critical-fg',
              tone === 'neutral' && 'bg-surface-subtle text-ink-secondary',
            )}
          >
            {!isFlat ? (
              <svg
                className={cn('h-3 w-3', !rising && 'rotate-180')}
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M6 9.5v-7M3 5.5 6 2.5l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {isFlat ? 'No change' : formatPercent(change!)}
          </span>
        ) : null}
        {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
      </div>
    </div>
  );
}
