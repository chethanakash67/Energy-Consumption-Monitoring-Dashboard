'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_STYLE,
  AreaGradient,
  ChartTooltip,
  CURSOR_LINE,
  GRID_STYLE,
  glowStroke,
} from './ChartPrimitives';
import { Button } from '@/components/ui/Button';
import {
  formatAxisTime,
  formatCurrency,
  formatEnergy,
  formatEnergyTick,
  formatTooltipTime,
  spansMultipleDays,
} from '@/lib/format';
import type { Granularity, SeriesPoint } from '@/lib/types';

/**
 * Per-device time series with drag-to-zoom.
 *
 * Dragging across the plot selects a window; the chart then re-scales to that
 * slice client-side. This is a *view* zoom over data already fetched — it does
 * not refetch at finer granularity, so the reset button is always offered to
 * make the current scope obvious.
 */
export function DeviceSeriesChart({
  points,
  granularity,
  currency,
  threshold,
  isProducer,
  height = 320,
}: {
  points: SeriesPoint[];
  granularity: Granularity;
  currency: string;
  threshold?: number | null;
  isProducer?: boolean;
  height?: number;
}) {
  // In-progress drag selection.
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  // Committed zoom window, as indices into `points`.
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  const data = useMemo(
    () =>
      points.map((point) => ({
        timestamp: point.timestamp,
        // Producers report negative kWh; plot the magnitude and say so in the
        // axis label, rather than drawing a chart that hangs below zero.
        kwh: isProducer ? Math.abs(point.kwh) : point.kwh,
        cost: point.cost,
      })),
    [points, isProducer],
  );

  const visible = useMemo(
    () => (zoom ? data.slice(zoom[0], zoom[1] + 1) : data),
    [data, zoom],
  );

  const multiDay = useMemo(() => spansMultipleDays(visible), [visible]);

  function commitZoom() {
    if (!dragStart || !dragEnd || dragStart === dragEnd) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startIndex = data.findIndex((row) => row.timestamp === dragStart);
    const endIndex = data.findIndex((row) => row.timestamp === dragEnd);
    const [low, high] = [startIndex, endIndex].sort((a, b) => a - b);

    // Require a few buckets so a stray click doesn't zoom to nothing.
    if (low >= 0 && high - low >= 2) setZoom([low, high]);

    setDragStart(null);
    setDragEnd(null);
  }

  const peak = useMemo(
    () => visible.reduce((max, row) => Math.max(max, row.kwh), 0),
    [visible],
  );

  /**
   * The threshold is defined per 15-minute interval, so it is only comparable
   * to the plotted values when the buckets *are* 15-minute intervals. At
   * hourly or daily granularity each bucket sums several intervals, and
   * drawing the line would invite reading a 4x-larger bar as a breach.
   */
  const thresholdComparable = granularity === 'interval';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {zoom ? (
            <>
              Zoomed to{' '}
              <span className="font-medium text-ink-secondary">{visible.length}</span> of{' '}
              {data.length} buckets
            </>
          ) : (
            'Drag across the chart to zoom'
          )}
          {threshold && !thresholdComparable ? (
            <>
              {' · '}
              <span>
                Threshold is per 15-minute interval — switch to 24h to see it plotted
              </span>
            </>
          ) : null}
        </p>
        {zoom ? (
          <Button size="sm" variant="subtle" onClick={() => setZoom(null)}>
            Reset zoom
          </Button>
        ) : null}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={visible}
          margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
          onMouseDown={(event: any) => event?.activeLabel && setDragStart(event.activeLabel)}
          onMouseMove={(event: any) =>
            dragStart && event?.activeLabel && setDragEnd(event.activeLabel)
          }
          onMouseUp={commitZoom}
        >
          <defs>
            <AreaGradient
              id="device-series"
              color={isProducer ? 'var(--series-8)' : 'var(--series-1)'}
            />
          </defs>

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
              const row = payload[0].payload as { kwh: number; cost: number };

              return (
                <ChartTooltip
                  title={formatTooltipTime(String(label), granularity)}
                  rows={[
                    {
                      label: isProducer ? 'Generated' : 'Consumed',
                      value: formatEnergy(row.kwh),
                      color: isProducer ? 'var(--series-8)' : 'var(--series-1)',
                    },
                    {
                      label: 'Cost',
                      value: formatCurrency(Math.abs(row.cost), currency, { decimals: 2 }),
                      muted: true,
                    },
                  ]}
                  footer={
                    threshold && thresholdComparable && row.kwh > threshold
                      ? `Above the ${threshold} kWh threshold`
                      : undefined
                  }
                />
              );
            }}
          />

          {/* Only drawn when the bucket size matches the threshold's basis,
              and when the line would actually fall inside the plot. */}
          {threshold && thresholdComparable && threshold < peak * 1.5 ? (
            <ReferenceLine
              y={threshold}
              stroke="var(--status-critical)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Threshold ${threshold} kWh`,
                position: 'insideTopRight',
                fill: 'var(--status-critical)',
                fontSize: 10,
              }}
            />
          ) : null}

          <Area
            type="monotone"
            dataKey="kwh"
            stroke={isProducer ? 'var(--series-8)' : 'var(--series-1)'}
            strokeWidth={2}
            style={glowStroke(isProducer ? 'var(--series-8)' : 'var(--series-1)')}
            fill="url(#device-series)"
            dot={false}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              stroke: 'var(--bg-surface)',
              fill: isProducer ? 'var(--series-8)' : 'var(--series-1)',
            }}
            isAnimationActive={false}
          />

          {dragStart && dragEnd ? (
            <ReferenceArea
              x1={dragStart}
              x2={dragEnd}
              fill="var(--brand)"
              fillOpacity={0.12}
              stroke="var(--brand)"
              strokeOpacity={0.4}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
