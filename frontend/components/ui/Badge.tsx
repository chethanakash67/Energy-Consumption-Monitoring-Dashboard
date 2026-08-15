import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'optimal'
  | 'elevated'
  | 'high'
  | 'critical';

/**
 * Status colours always ship with a label (and usually a dot), never colour
 * alone — the same rule the charts follow.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-secondary border-line',
  brand: 'bg-brand-subtle text-brand border-transparent',
  optimal: 'bg-optimal-subtle text-optimal-fg border-transparent',
  elevated: 'bg-elevated-subtle text-elevated-fg border-transparent',
  high: 'bg-high-subtle text-high-fg border-transparent',
  critical: 'bg-critical-subtle text-critical-fg border-transparent',
};

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-muted',
  brand: 'bg-brand',
  optimal: 'bg-optimal',
  elevated: 'bg-elevated',
  high: 'bg-high',
  critical: 'bg-critical',
};

const DOT_GLOW: Record<BadgeTone, string> = {
  neutral: '',
  brand: 'shadow-[0_0_6px_1px_var(--glow-brand)]',
  optimal: 'shadow-[0_0_6px_1px_var(--glow-optimal)]',
  elevated: 'shadow-[0_0_6px_1px_var(--glow-elevated)]',
  high: 'shadow-[0_0_6px_1px_var(--glow-high)]',
  critical: 'shadow-[0_0_6px_1px_var(--glow-critical)]',
};

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  /** Adds a soft pulse — used for a live/online indicator. */
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  pulse = false,
  size = 'sm',
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse-ring',
                DOT_TONES[tone],
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              DOT_TONES[tone],
              pulse && DOT_GLOW[tone],
            )}
          />
        </span>
      ) : null}
      {children}
    </span>
  );
}
