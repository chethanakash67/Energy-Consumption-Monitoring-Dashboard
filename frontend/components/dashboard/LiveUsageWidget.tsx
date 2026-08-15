'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { AreaGradient, glowStroke } from '@/components/charts/ChartPrimitives';
import { useLive } from '@/lib/live';
import { formatCurrency, formatPower } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Real-time demand widget, fed by the SSE stream.
 *
 * Shows instantaneous power (kW) plus the top drawing devices right now. The
 * sparkline is a rolling ~2.5-minute window of live samples — it is
 * deliberately axis-less, because its job is to show *movement*, not values;
 * the exact figure sits above it.
 */
export function LiveUsageWidget({ currency }: { currency: string }) {
  const { latest, history, status } = useLive();

  const sparkline = useMemo(
    () => history.map((sample, index) => ({ index, kw: sample.totalKw })),
    [history],
  );

  // Top consumers right now, generation excluded.
  const topDevices = useMemo(() => {
    if (!latest) return [];
    return [...latest.devices]
      .filter((device) => device.kw > 0)
      .sort((a, b) => b.kw - a.kw)
      .slice(0, 4);
  }, [latest]);

  const peakKw = Math.max(...sparkline.map((point) => point.kw), 1);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Live usage"
        description="Demand across all devices"
        action={
          status === 'live' ? (
            <Badge tone="optimal" dot pulse>
              Live
            </Badge>
          ) : status === 'connecting' ? (
            <Badge tone="elevated" dot>
              Connecting
            </Badge>
          ) : (
            <Badge tone="critical" dot>
              Offline
            </Badge>
          )
        }
      />

      <CardBody className="flex flex-1 flex-col">
        {!latest ? (
          <LiveSkeleton />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p
                  className="font-numeric text-4xl font-semibold leading-none tracking-tight text-ink tabular-nums"
                  style={{ textShadow: '0 0 24px var(--text-glow-brand)' }}
                >
                  {formatPower(latest.totalKw)}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  ≈{' '}
                  <span className="font-medium text-ink-secondary tnum">
                    {formatCurrency(latest.costPerHour, currency, { decimals: 2 })}
                  </span>{' '}
                  per hour at current rate
                </p>
              </div>

              {latest.generationKw > 0.05 ? (
                <div className="text-right">
                  <p className="text-2xs uppercase tracking-wide text-ink-muted">Solar</p>
                  <p className="font-numeric text-lg font-semibold text-optimal tabular-nums">
                    {formatPower(latest.generationKw)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="-mx-1 mt-4 h-16">
              {sparkline.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkline} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <AreaGradient id="live-spark" color="var(--series-1)" opacity={0.32} />
                    </defs>
                    {/* Domain padded so the trace never touches the edges. */}
                    <YAxis hide domain={[0, peakKw * 1.15]} />
                    <Area
                      type="monotone"
                      dataKey="kw"
                      stroke="var(--series-1)"
                      strokeWidth={2}
                      style={glowStroke('var(--series-1)')}
                      fill="url(#live-spark)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md bg-surface-subtle">
                  <p className="text-2xs text-ink-muted">Collecting samples…</p>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-line pt-3.5">
              <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Drawing most
              </p>
              <ul className="mt-2.5 space-y-2">
                {topDevices.map((device) => (
                  <li key={device.deviceId} className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
                      {device.name}
                    </span>
                    <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface-inset sm:w-20">
                      <span
                        className={cn(
                          'block h-full rounded-full bg-brand transition-[width] duration-700 ease-smooth',
                        )}
                        style={{
                          width: `${Math.min(100, (device.kw / (topDevices[0]?.kw || 1)) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs font-semibold text-ink tnum">
                      {formatPower(device.kw)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function LiveSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2.5 h-3 w-52" />
      <Skeleton className="mt-4 h-16 w-full" />
      <div className="mt-4 space-y-2.5 border-t border-line pt-3.5">
        <Skeleton className="h-3 w-24" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}
