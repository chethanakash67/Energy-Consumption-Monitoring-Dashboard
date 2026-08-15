'use client';

import { formatCurrency, formatEnergy } from '@/lib/format';
import type { BreakdownSlice } from '@/lib/types';

/**
 * Consumption by location.
 *
 * A plain horizontal bar list rather than a charting-library bar chart: with
 * four categories and long labels, HTML bars give better typography, wrap
 * correctly on mobile, and stay readable without a tooltip.
 *
 * All bars share slot 1 — these are nominal categories, so colour would be
 * re-encoding what bar length already shows.
 */
export function LocationBars({
  slices,
  currency,
}: {
  slices: BreakdownSlice[];
  currency: string;
}) {
  const consumers = slices.filter((slice) => slice.kwh > 0);
  const max = Math.max(...consumers.map((slice) => slice.kwh), 1);

  return (
    <ul className="space-y-3.5">
      {consumers.map((slice) => (
        <li key={slice.key} className="group">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-medium text-ink">{slice.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="text-xs font-semibold text-ink tnum">
                {formatEnergy(slice.kwh, { decimals: 1 })}
              </span>
              <span className="text-2xs text-ink-muted tnum">
                {formatCurrency(slice.cost, currency)}
              </span>
            </span>
          </div>

          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full transition-all duration-500 ease-smooth group-hover:brightness-110"
              style={{
                width: `${(slice.kwh / max) * 100}%`,
                backgroundColor: 'var(--series-1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
