'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_STYLE,
  ChartLegend,
  ChartTooltip,
  CURSOR_LINE,
  GRID_STYLE,
  glowStroke,
} from './ChartPrimitives';
import { seriesColor } from '@/lib/constants';
import {
  formatAxisTime,
  formatEnergy,
  formatEnergyTick,
  formatTooltipTime,
  spansMultipleDays,
} from '@/lib/format';
import type { ComparisonSeries, Granularity } from '@/lib/types';

/**
 * Multi-entity comparison (device vs device, or site vs site).
 *
 * Capped at eight series because that is how many fixed categorical slots
 * exist — a ninth line would have to reuse a hue and break identity. Anything
 * beyond the top eight is grouped out rather than recoloured.
 */
const MAX_SERIES = 8;

export function ComparisonChart({
  series,
  granularity,
  height = 320,
}: {
  series: ComparisonSeries[];
  granularity: Granularity;
  height?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const shown = useMemo(() => series.slice(0, MAX_SERIES), [series]);

  /**
   * Colour is bound to the entity's identity via its position in the *full*
   * sorted list, so hiding one series never repaints the others.
   */
  const colorByKey = useMemo(() => {
    const map = new Map<string, string>();
    shown.forEach((entry, index) => map.set(entry.key, seriesColor(index)));
    return map;
  }, [shown]);

  // Pivot from per-series point arrays into one row per timestamp.
  const data = useMemo(() => {
    const byTimestamp = new Map<string, Record<string, number | string>>();

    for (const entry of shown) {
      for (const point of entry.points) {
        let row = byTimestamp.get(point.timestamp);
        if (!row) {
          row = { timestamp: point.timestamp };
          byTimestamp.set(point.timestamp, row);
        }
        row[entry.key] = point.kwh;
      }
    }

    return [...byTimestamp.values()].sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)),
    );
  }, [shown]);

  const multiDay = useMemo(
    () => spansMultipleDays(data as { timestamp: string }[]),
    [data],
  );

  function toggle(key: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (shown.length === 0) return null;

  return (
    <div>
      <ChartLegend
        className="mb-4"
        items={shown.map((entry) => ({
          label: entry.label,
          color: colorByKey.get(entry.key)!,
          value: formatEnergy(entry.totalKwh, { decimals: 1 }),
          inactive: hidden.has(entry.key),
          onClick: () => toggle(entry.key),
        }))}
      />

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRID_STYLE} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: string) => formatAxisTime(value, granularity, multiDay)}
            minTickGap={56}
            {...AXIS_STYLE}
          />
          <YAxis tickFormatter={formatEnergyTick} width={52} {...AXIS_STYLE} axisLine={false} />

          <Tooltip
            cursor={CURSOR_LINE}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;

              const rows = [...payload]
                .sort((a, b) => Number(b.value) - Number(a.value))
                .map((item) => {
                  const entry = shown.find((candidate) => candidate.key === item.dataKey);
                  return {
                    label: entry?.label ?? String(item.dataKey),
                    value: formatEnergy(Number(item.value)),
                    color: colorByKey.get(String(item.dataKey)),
                  };
                });

              return (
                <ChartTooltip
                  title={formatTooltipTime(String(label), granularity)}
                  rows={rows}
                />
              );
            }}
          />

          {shown.map((entry) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              hide={hidden.has(entry.key)}
              stroke={colorByKey.get(entry.key)}
              strokeWidth={2}
              style={glowStroke(colorByKey.get(entry.key)!)}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'var(--bg-surface)',
                fill: colorByKey.get(entry.key),
              }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {series.length > MAX_SERIES ? (
        <p className="mt-3 text-2xs text-ink-muted">
          Showing the {MAX_SERIES} highest-consuming of {series.length}. Narrow the filters to
          compare the rest.
        </p>
      ) : null}
    </div>
  );
}
