'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_STYLE,
  AreaGradient,
  ChartLegend,
  ChartTooltip,
  CURSOR_LINE,
  GRID_STYLE,
  glowStroke,
} from './ChartPrimitives';
import {
  formatCurrency,
  formatCurrencyTick,
  formatEnergy,
  formatEnergyTick,
  formatAxisTime,
  formatTooltipTime,
  spansMultipleDays,
} from '@/lib/format';
import type { Granularity, SeriesPoint } from '@/lib/types';

export type TrendMetric = 'energy' | 'cost';

interface TrendChartProps {
  points: SeriesPoint[];
  granularity: Granularity;
  metric: TrendMetric;
  currency: string;
  height?: number;
}

/**
 * Consumption trend.
 *
 * Draws grid draw and on-site solar generation as two gradient areas on a
 * single kWh axis. Generation is plotted as a positive magnitude so the two
 * are directly comparable — the legend and tooltip name which is which, so
 * the sign convention never has to be inferred from the shape.
 */
export function TrendChart({
  points,
  granularity,
  metric,
  currency,
  height = 300,
}: TrendChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const hasGeneration = useMemo(
    () => points.some((point) => point.generationKwh > 0.01),
    [points],
  );

  const multiDay = useMemo(() => spansMultipleDays(points), [points]);

  const data = useMemo(
    () =>
      points.map((point) => ({
        timestamp: point.timestamp,
        consumption: metric === 'energy' ? point.consumptionKwh : point.cost,
        generation: metric === 'energy' ? point.generationKwh : 0,
      })),
    [points, metric],
  );

  const formatValue = (value: number) =>
    metric === 'energy' ? formatEnergy(value) : formatCurrency(value, currency, { decimals: 2 });

  const formatTick = (value: number) =>
    metric === 'energy' ? formatEnergyTick(value) : formatCurrencyTick(value, currency);

  const totals = useMemo(
    () => ({
      consumption: data.reduce((sum, row) => sum + row.consumption, 0),
      generation: data.reduce((sum, row) => sum + row.generation, 0),
    }),
    [data],
  );

  // Only offer the generation series when solar actually contributes and the
  // metric is energy — cost has no meaningful generation counterpart here.
  const showGeneration = hasGeneration && metric === 'energy';

  const legendItems = [
    {
      label: 'Grid consumption',
      color: 'var(--series-1)',
      value: formatValue(totals.consumption),
      inactive: hidden.has('consumption'),
      onClick: () => toggle('consumption'),
    },
    ...(showGeneration
      ? [
          {
            label: 'Solar generation',
            color: 'var(--series-8)',
            value: formatEnergy(totals.generation),
            inactive: hidden.has('generation'),
            onClick: () => toggle('generation'),
          },
        ]
      : []),
  ];

  function toggle(key: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      {/* A legend is present whenever two series are drawn. */}
      {legendItems.length > 1 ? (
        <ChartLegend items={legendItems} className="mb-4" />
      ) : (
        <p className="mb-4 text-xs text-ink-muted">
          Total{' '}
          <span className="font-semibold text-ink tnum">{formatValue(totals.consumption)}</span>
        </p>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <AreaGradient id="trend-consumption" color="var(--series-1)" />
            <AreaGradient id="trend-generation" color="var(--series-8)" opacity={0.22} />
          </defs>

          <CartesianGrid {...GRID_STYLE} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: string) => formatAxisTime(value, granularity, multiDay)}
            minTickGap={56}
            {...AXIS_STYLE}
          />
          <YAxis tickFormatter={formatTick} width={52} {...AXIS_STYLE} axisLine={false} />

          <Tooltip
            cursor={CURSOR_LINE}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;

              const consumption = payload.find((item) => item.dataKey === 'consumption');
              const generation = payload.find((item) => item.dataKey === 'generation');

              const rows = [];
              if (consumption) {
                rows.push({
                  label: 'Grid consumption',
                  value: formatValue(Number(consumption.value)),
                  color: 'var(--series-1)',
                });
              }
              if (generation && Number(generation.value) > 0) {
                rows.push({
                  label: 'Solar generation',
                  value: formatEnergy(Number(generation.value)),
                  color: 'var(--series-8)',
                });
                rows.push({
                  label: 'Net',
                  value: formatEnergy(
                    Number(consumption?.value ?? 0) - Number(generation.value),
                  ),
                  muted: true,
                });
              }

              return (
                <ChartTooltip
                  title={formatTooltipTime(String(label), granularity)}
                  rows={rows}
                />
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="consumption"
            hide={hidden.has('consumption')}
            stroke="var(--series-1)"
            strokeWidth={2}
            style={glowStroke('var(--series-1)')}
            fill="url(#trend-consumption)"
            // A dot per point would be noise at 15-minute granularity; the
            // crosshair cursor plus tooltip carries the read instead.
            dot={false}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              stroke: 'var(--bg-surface)',
              fill: 'var(--series-1)',
            }}
            isAnimationActive={false}
          />

          {showGeneration ? (
            <Area
              type="monotone"
              dataKey="generation"
              hide={hidden.has('generation')}
              stroke="var(--series-8)"
              strokeWidth={2}
              style={glowStroke('var(--series-8)')}
              fill="url(#trend-generation)"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'var(--bg-surface)',
                fill: 'var(--series-8)',
              }}
              isAnimationActive={false}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
