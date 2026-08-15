'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared chart chrome.
 *
 * Recharts' defaults are replaced everywhere: tooltips, legends, axis styling,
 * and gradient fills all come from here so every chart in the product reads as
 * one system.
 */

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  /** Renders muted, for context lines like "expected" or a baseline. */
  muted?: boolean;
}

/** The single tooltip surface used by every chart. */
export function ChartTooltip({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="glass-strong glass-edge pointer-events-none min-w-[10rem] overflow-hidden rounded-lg shadow-pop">
      <div className="border-b border-line px-3 py-2">
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{title}</p>
      </div>
      <div className="space-y-1.5 px-3 py-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5">
              {row.color ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              ) : null}
              <span
                className={cn(
                  'truncate text-xs',
                  row.muted ? 'text-ink-muted' : 'text-ink-secondary',
                )}
              >
                {row.label}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-xs font-semibold tnum',
                row.muted ? 'text-ink-muted' : 'text-ink',
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <div className="border-t border-line bg-surface-subtle/60 px-3 py-1.5 text-2xs text-ink-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
  /** Dimmed when the series is toggled off. */
  inactive?: boolean;
  onClick?: () => void;
}

/**
 * Legend. Present whenever a chart draws two or more series — identity is
 * never carried by colour alone.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => {
        const content = (
          <>
            <span
              className="h-2 w-2 shrink-0 rounded-full transition-opacity"
              style={{ backgroundColor: item.color, opacity: item.inactive ? 0.3 : 1 }}
            />
            <span
              className={cn(
                'truncate text-xs transition-colors',
                item.inactive ? 'text-ink-muted line-through' : 'text-ink-secondary',
              )}
            >
              {item.label}
            </span>
            {item.value ? (
              <span className="shrink-0 text-xs font-medium text-ink tnum">{item.value}</span>
            ) : null}
          </>
        );

        return item.onClick ? (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="flex min-w-0 items-center gap-1.5 rounded-sm transition-opacity hover:opacity-70"
          >
            {content}
          </button>
        ) : (
          <span key={item.label} className="flex min-w-0 items-center gap-1.5">
            {content}
          </span>
        );
      })}
    </div>
  );
}

/** Axis tick/label styling shared by every Recharts axis in the product. */
export const AXIS_STYLE = {
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
  axisLine: { stroke: 'var(--chart-axis)' },
  tickLine: false as const,
};

export const GRID_STYLE = {
  stroke: 'var(--chart-grid)',
  strokeDasharray: '0',
  vertical: false,
};

/**
 * Vertical gradient used for area fills: a tinted top fading to transparent,
 * so overlapping areas stay readable.
 */
export function AreaGradient({
  id,
  color,
  opacity = 0.28,
}: {
  id: string;
  color: string;
  opacity?: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="60%" stopColor={color} stopOpacity={opacity * 0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

/** Crosshair cursor for line/area charts — a hairline, not a grey slab. */
export const CURSOR_LINE = {
  stroke: 'var(--chart-axis)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
};

/** Hover wash for bar charts. */
export const CURSOR_FILL = { fill: 'var(--bg-subtle)', radius: 4 };

/**
 * A soft neon trace along a line/area stroke. `--chart-glow-blur` is 0 in
 * light mode (crisp, printable lines) and ~5px in dark mode, so this is a
 * no-op until dark mode turns it on.
 */
export function glowStroke(colorVar: string): { filter: string } {
  return { filter: `drop-shadow(0 0 var(--chart-glow-blur) ${colorVar})` };
}
