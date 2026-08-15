'use client';

import { useMemo, useState } from 'react';
import { SEQUENTIAL_RAMP, WEEKDAY_LABELS } from '@/lib/constants';
import { formatEnergy } from '@/lib/format';
import type { HeatmapCell } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Peak-usage heatmap: hour of day x day of week.
 *
 * Colour encodes magnitude, so it uses the single-hue sequential ramp rather
 * than the categorical palette — a rainbow here would imply the hours are
 * different *kinds* of thing rather than more or less of one.
 *
 * Built from CSS grid rather than a charting library: 168 cells with a hover
 * readout is far lighter as plain DOM, and it re-flows on mobile for free.
 */
export function PeakHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const { grid, max, min, peak } = useMemo(() => {
    const lookup = new Map<string, HeatmapCell>();
    let maxValue = 0;
    let minValue = Number.POSITIVE_INFINITY;
    let peakCell: HeatmapCell | null = null;

    for (const cell of cells) {
      lookup.set(`${cell.dayOfWeek}-${cell.hour}`, cell);
      if (cell.avgKwh > maxValue) {
        maxValue = cell.avgKwh;
        peakCell = cell;
      }
      if (cell.avgKwh < minValue) minValue = cell.avgKwh;
    }

    return {
      grid: lookup,
      max: maxValue,
      min: Number.isFinite(minValue) ? minValue : 0,
      peak: peakCell,
    };
  }, [cells]);

  /** Maps a value onto one of the seven sequential steps. */
  function colorFor(value: number): string {
    if (max === min) return SEQUENTIAL_RAMP[3];
    const normalised = (value - min) / (max - min);
    const step = Math.min(
      SEQUENTIAL_RAMP.length - 1,
      Math.floor(normalised * SEQUENTIAL_RAMP.length),
    );
    return SEQUENTIAL_RAMP[step];
  }

  const active = hovered;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-[2.25rem]">
          {active ? (
            <>
              <p className="text-sm font-semibold text-ink tnum">
                {formatEnergy(active.avgKwh)}
                <span className="ml-1.5 text-xs font-normal text-ink-muted">avg</span>
              </p>
              <p className="text-2xs text-ink-muted">
                {WEEKDAY_LABELS[active.dayOfWeek]} at {formatHour(active.hour)}
              </p>
            </>
          ) : peak ? (
            <>
              <p className="text-sm font-semibold text-ink tnum">
                Peak {formatEnergy(peak.avgKwh)}
                <span className="ml-1.5 text-xs font-normal text-ink-muted">avg</span>
              </p>
              <p className="text-2xs text-ink-muted">
                {WEEKDAY_LABELS[peak.dayOfWeek]} at {formatHour(peak.hour)}
              </p>
            </>
          ) : null}
        </div>

        {/* Ramp legend — light means low, dark means high. */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-ink-muted tnum">{formatEnergy(min)}</span>
          <div className="flex gap-0.5">
            {SEQUENTIAL_RAMP.map((color) => (
              <span
                key={color}
                className="h-3 w-4 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="text-2xs text-ink-muted tnum">{formatEnergy(max)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          {/* Hour axis */}
          <div className="mb-1 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5">
            <span />
            {Array.from({ length: 24 }).map((_, hour) => (
              <span
                key={hour}
                className="text-center text-[9px] leading-none text-ink-muted"
              >
                {hour % 3 === 0 ? hour : ''}
              </span>
            ))}
          </div>

          {WEEKDAY_LABELS.map((label, dayOfWeek) => (
            <div
              key={label}
              className="mb-0.5 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5"
            >
              <span className="flex items-center text-[10px] text-ink-muted">{label}</span>
              {Array.from({ length: 24 }).map((_, hour) => {
                const cell = grid.get(`${dayOfWeek}-${hour}`);
                if (!cell) {
                  return (
                    <span
                      key={hour}
                      className="h-5 rounded-[3px] bg-surface-inset"
                      title="No data"
                    />
                  );
                }

                const isActive =
                  active?.dayOfWeek === dayOfWeek && active?.hour === hour;

                return (
                  <button
                    key={hour}
                    type="button"
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(cell)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${label} ${formatHour(hour)}: ${formatEnergy(cell.avgKwh)} average`}
                    className={cn(
                      'h-5 rounded-[3px] transition-all duration-150',
                      isActive
                        ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface shadow-[0_0_10px_1px_var(--glow-brand)]'
                        : 'hover:brightness-110 hover:shadow-[0_0_6px_0_var(--glow-brand)]',
                    )}
                    style={{ backgroundColor: colorFor(cell.avgKwh) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}
