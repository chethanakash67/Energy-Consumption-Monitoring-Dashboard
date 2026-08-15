'use client';

import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconClock, IconLeaf, IconPulse, IconSun } from '@/components/layout/Icons';
import { useLive } from '@/lib/live';
import {
  formatCurrency,
  formatNumber,
  formatPower,
  formatRelative,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export function RealtimeInsights({ currency }: { currency: string }) {
  const { status, realtimeStatus, refreshRealtimeStatus } = useLive();
  const snapshot = realtimeStatus?.latest;

  if (!realtimeStatus) {
    return (
      <Card>
        <CardHeader title="Realtime API analytics" description="Waiting for live feed status" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  const solarOffset =
    snapshot && snapshot.demandKw > 0
      ? Math.min(100, (snapshot.generationKw / snapshot.demandKw) * 100)
      : 0;
  const carbonTone = carbonBadgeTone(snapshot?.carbonGPerKwh ?? null);
  const freshness = realtimeStatus.lastPullAt ? formatRelative(realtimeStatus.lastPullAt) : 'never';
  const sourceNames = realtimeStatus.sources.map((source) => source.name).join(' + ');

  return (
    <Card>
      <CardHeader
        title="Realtime API analytics"
        description={sourceNames || 'External feed status'}
        action={
          realtimeStatus.running && status === 'live' ? (
            <Badge tone="optimal" dot pulse>
              Live
            </Badge>
          ) : realtimeStatus.enabled ? (
            <Badge tone="elevated" dot>
              Syncing
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Paused
            </Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {realtimeStatus.lastError ? (
          <div className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2 text-xs text-critical-fg">
            {realtimeStatus.lastError}
          </div>
        ) : null}

        {!snapshot ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">No realtime pull has completed yet.</p>
            <Button size="sm" variant="secondary" onClick={refreshRealtimeStatus}>
              Refresh
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RealtimeMetric
                icon={<IconPulse className="h-4 w-4" />}
                label="Net load"
                value={formatPower(snapshot.netKw)}
                detail={`${formatPower(snapshot.demandKw)} demand`}
                tone={snapshot.netKw > snapshot.demandKw * 0.85 ? 'high' : 'brand'}
              />
              <RealtimeMetric
                icon={<IconSun className="h-4 w-4" />}
                label="Solar offset"
                value={`${formatNumber(solarOffset, 0)}%`}
                detail={`${formatPower(snapshot.generationKw)} generating`}
                tone={solarOffset >= 30 ? 'optimal' : 'elevated'}
              />
              <RealtimeMetric
                icon={<IconLeaf className="h-4 w-4" />}
                label="Carbon intensity"
                value={
                  snapshot.carbonGPerKwh === null
                    ? 'N/A'
                    : `${formatNumber(snapshot.carbonGPerKwh, 0)} g/kWh`
                }
                detail={snapshot.carbonIndex ?? 'Carbon feed unavailable'}
                tone={carbonTone}
              />
              <RealtimeMetric
                icon={<IconClock className="h-4 w-4" />}
                label="Run rate"
                value={formatCurrency(snapshot.costPerHour, currency, { decimals: 2 })}
                detail={`Updated ${freshness}`}
                tone="neutral"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 md:grid-cols-3">
              <Signal label="Temperature" value={`${formatNumber(snapshot.temperatureC, 1)} C`} />
              <Signal label="Cloud cover" value={`${formatNumber(snapshot.cloudCoverPct, 0)}%`} />
              <Signal
                label="Solar radiation"
                value={`${formatNumber(snapshot.solarRadiationWm2, 0)} W/m2`}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function RealtimeMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: BadgeTone;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-subtle p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md',
            tone === 'optimal'
              ? 'bg-optimal-subtle text-optimal-fg shadow-[0_0_10px_-2px_var(--glow-optimal)]'
              : tone === 'high' || tone === 'critical'
                ? 'bg-high-subtle text-high-fg shadow-[0_0_10px_-2px_var(--glow-high)]'
                : tone === 'elevated'
                  ? 'bg-elevated-subtle text-elevated-fg shadow-[0_0_10px_-2px_var(--glow-elevated)]'
                  : 'bg-brand-subtle text-brand shadow-[0_0_10px_-2px_var(--glow-brand)]',
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 font-numeric text-2xl font-semibold leading-none tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-2 truncate text-xs text-ink-muted">{detail}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-xs font-semibold text-ink tnum">{value}</span>
    </div>
  );
}

function carbonBadgeTone(value: number | null): BadgeTone {
  if (value === null) return 'neutral';
  if (value < 150) return 'optimal';
  if (value < 300) return 'elevated';
  if (value < 450) return 'high';
  return 'critical';
}
