'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartPrimitives';
import { DEVICE_TYPE_META } from '@/lib/constants';
import { formatCurrency, formatEnergy } from '@/lib/format';
import type { BreakdownSlice, DeviceType } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Consumption share by device type.
 *
 * A donut is defensible here because the parts genuinely sum to a whole
 * (total grid draw) and there are at most eight of them. Every slice is also
 * listed with its exact value beside the chart, so the reader never has to
 * judge angles — the list is the real data, the donut is the summary.
 *
 * Solar is excluded: it generates rather than consumes, so it has no share of
 * consumption. It's surfaced as a footnote instead.
 */
export function BreakdownDonut({
  slices,
  currency,
  height = 184,
}: {
  slices: BreakdownSlice[];
  currency: string;
  height?: number;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const consumers = slices.filter((slice) => slice.kwh > 0);
  const producers = slices.filter((slice) => slice.kwh < 0);
  const total = consumers.reduce((sum, slice) => sum + slice.kwh, 0);

  const colorFor = (key: string) =>
    DEVICE_TYPE_META[key as DeviceType]?.colorVar ?? 'var(--series-1)';
  const labelFor = (key: string) =>
    DEVICE_TYPE_META[key as DeviceType]?.label ?? key;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={consumers}
              dataKey="kwh"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              // 2px of surface between segments keeps adjacent fills legible.
              paddingAngle={2}
              stroke="var(--bg-surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActiveKey(consumers[index]?.key ?? null)}
              onMouseLeave={() => setActiveKey(null)}
            >
              {consumers.map((slice) => (
                <Cell
                  key={slice.key}
                  fill={colorFor(slice.key)}
                  opacity={activeKey && activeKey !== slice.key ? 0.35 : 1}
                  style={{ transition: 'opacity 150ms ease-out', outline: 'none' }}
                />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const slice = payload[0].payload as BreakdownSlice;
                return (
                  <ChartTooltip
                    title={labelFor(slice.key)}
                    rows={[
                      {
                        label: 'Consumption',
                        value: formatEnergy(slice.kwh),
                        color: colorFor(slice.key),
                      },
                      { label: 'Cost', value: formatCurrency(slice.cost, currency) },
                      { label: 'Share', value: `${slice.share}%`, muted: true },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre readout — the hovered slice, or the total at rest. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {(() => {
            const active = consumers.find((slice) => slice.key === activeKey);
            return (
              <>
                <span className="font-numeric text-xl font-semibold tracking-tight text-ink">
                  {active ? `${active.share}%` : formatEnergy(total, { decimals: 1 })}
                </span>
                <span className="mt-0.5 max-w-[7rem] truncate text-center text-2xs text-ink-muted">
                  {active ? labelFor(active.key) : 'Total consumed'}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {/* The list is the precise read; the donut is the shape. */}
      <ul className="min-w-0 flex-1 space-y-1">
        {consumers.map((slice) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150',
              activeKey === slice.key ? 'bg-surface-subtle' : 'bg-transparent',
            )}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(slice.key) }}
            />
            <span className="min-w-0 flex-1 text-xs text-ink-secondary">
              {labelFor(slice.key)}
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-ink tnum">
              {formatEnergy(slice.kwh, { decimals: 1 })}
            </span>
            <span className="w-9 shrink-0 text-right text-xs text-ink-muted tnum">
              {slice.share}%
            </span>
          </li>
        ))}

        {producers.map((slice) => (
          <li
            key={slice.key}
            className="mt-2 flex items-center gap-2.5 rounded-md border-t border-line px-2 pt-2.5"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(slice.key) }}
            />
            <span className="min-w-0 flex-1 text-xs text-ink-secondary">
              {labelFor(slice.key)}
              <span className="ml-1 text-ink-muted">generated</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-optimal-fg tnum">
              {formatEnergy(Math.abs(slice.kwh), { decimals: 1 })}
            </span>
            <span className="w-9 shrink-0" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
