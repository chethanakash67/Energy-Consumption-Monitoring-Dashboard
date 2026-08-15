'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonChart, SkeletonKpi, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { TrendChart, type TrendMetric } from '@/components/charts/TrendChart';
import { BreakdownDonut } from '@/components/charts/BreakdownDonut';
import { LocationBars } from '@/components/charts/LocationBars';
import { LiveUsageWidget } from '@/components/dashboard/LiveUsageWidget';
import { RealtimeInsights } from '@/components/analytics/RealtimeInsights';
import { AlertRow } from '@/components/alerts/AlertRow';
import {
  IconBolt,
  IconChevronRight,
  IconCoins,
  IconDevices,
  IconInbox,
  IconLeaf,
} from '@/components/layout/Icons';
import { RANGE_OPTIONS } from '@/lib/constants';
import { useRange } from '@/lib/useRange';
import { useAlertActions } from '@/lib/useAlertActions';
import { formatCarbon, formatCurrency, formatEnergy, formatNumber } from '@/lib/format';
import type {
  AlertsResponse,
  BreakdownSlice,
  RangeKey,
  SeriesResponse,
  Summary,
} from '@/lib/types';

export default function DashboardPage() {
  const { range, query, setPreset, comparisonLabel } = useRange('7d');
  const [metric, setMetric] = useState<TrendMetric>('energy');
  const realtimeQuery = `${query}&source=realtime`;

  const summary = useSWR<Summary>(`/api/analytics/summary?${realtimeQuery}`);
  const series = useSWR<SeriesResponse>(`/api/analytics/series?${realtimeQuery}`);
  const byType = useSWR<{ slices: BreakdownSlice[] }>(
    `/api/analytics/breakdown?dimension=type&${realtimeQuery}`,
  );
  const byLocation = useSWR<{ slices: BreakdownSlice[] }>(
    `/api/analytics/breakdown?dimension=location&${realtimeQuery}`,
  );
  const alerts = useSWR<AlertsResponse>('/api/alerts?source=realtime&status=open&limit=6');

  const currency = summary.data?.currency ?? 'USD';
  const { acknowledge, acknowledging } = useAlertActions();

  const rangeToggle = (
    <SegmentedControl
      aria-label="Time range"
      value={range.key}
      onChange={(value) => setPreset(value as RangeKey)}
      options={RANGE_OPTIONS.map(({ value, label, description }) => ({
        value,
        label,
        title: description,
      }))}
    />
  );

  return (
    <AppShell
      title="Dashboard"
      description="Estate-wide energy performance"
      actions={<div className="hidden sm:block">{rangeToggle}</div>}
    >
      <div className="space-y-5">
        {/* Range toggle moves inline on small screens where the header is tight. */}
        <div className="sm:hidden">{rangeToggle}</div>

        {/* ---- KPI row ---- */}
        {summary.error ? (
          <Card>
            <ErrorState onRetry={() => summary.mutate()} compact />
          </Card>
        ) : !summary.data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonKpi key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total consumption"
              value={summary.data.current.netKwh}
              format={(value) => formatEnergy(value, { decimals: 1 })}
              change={summary.data.change.netKwh}
              goodDirection="down"
              caption={comparisonLabel}
              icon={<IconBolt className="h-4 w-4" />}
            />
            <KpiCard
              label="Estimated cost"
              value={summary.data.current.cost}
              format={(value) => formatCurrency(value, currency, { compact: true })}
              change={summary.data.change.cost}
              goodDirection="down"
              caption={comparisonLabel}
              icon={<IconCoins className="h-4 w-4" />}
            />
            <KpiCard
              label="Carbon footprint"
              value={summary.data.current.carbonKg}
              format={formatCarbon}
              change={summary.data.change.carbonKg}
              goodDirection="down"
              caption={comparisonLabel}
              icon={<IconLeaf className="h-4 w-4" />}
            />
            <KpiCard
              label="Active devices"
              value={summary.data.activeDevices}
              format={(value) => formatNumber(Math.round(value))}
              goodDirection="neutral"
              caption={`of ${summary.data.totalDevices} total`}
              icon={<IconDevices className="h-4 w-4" />}
              visual={
                summary.data.openAlerts > 0 ? (
                  <Badge tone="critical" dot>
                    {summary.data.openAlerts} open
                  </Badge>
                ) : (
                  <Badge tone="optimal" dot>
                    All clear
                  </Badge>
                )
              }
            />
          </div>
        )}

        {/* ---- Trend + live ---- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Consumption trend"
              description={
                series.data
                  ? `${series.data.points.length} points · ${GRANULARITY_LABEL[series.data.granularity]}`
                  : undefined
              }
              action={
                <SegmentedControl
                  aria-label="Trend metric"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: 'energy', label: 'Energy' },
                    { value: 'cost', label: 'Cost' },
                  ]}
                />
              }
            />
            <CardBody>
              {series.error ? (
                <ErrorState onRetry={() => series.mutate()} compact />
              ) : !series.data ? (
                <>
                  <Skeleton className="mb-4 h-3 w-48" />
                  <SkeletonChart height={300} />
                </>
              ) : series.data.points.length === 0 ? (
                <EmptyState
                  icon={<IconBolt className="h-5 w-5" />}
                  title="No readings in this window"
                  description="Try a wider time range, or check that realtime ingestion is running on the backend."
                />
              ) : (
                <TrendChart
                  points={series.data.points}
                  granularity={series.data.granularity}
                  metric={metric}
                  currency={currency}
                />
              )}
            </CardBody>
          </Card>

          <LiveUsageWidget currency={currency} />
        </div>

        <RealtimeInsights currency={currency} />

        {/* ---- Breakdowns ---- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="By device type"
              description="Share of total grid consumption"
            />
            <CardBody>
              {byType.error ? (
                <ErrorState onRetry={() => byType.mutate()} compact />
              ) : !byType.data ? (
                <div className="flex items-center gap-5">
                  <Skeleton className="h-[220px] w-[220px] rounded-full" />
                  <div className="flex-1 space-y-2.5">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <Skeleton key={index} className="h-3.5 w-full" />
                    ))}
                  </div>
                </div>
              ) : byType.data.slices.length === 0 ? (
                <EmptyState title="No consumption recorded" compact />
              ) : (
                <BreakdownDonut slices={byType.data.slices} currency={currency} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="By location" description="Total consumption per site" />
            <CardBody>
              {byLocation.error ? (
                <ErrorState onRetry={() => byLocation.mutate()} compact />
              ) : !byLocation.data ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index}>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="mt-1.5 h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : byLocation.data.slices.length === 0 ? (
                <EmptyState title="No locations reporting" compact />
              ) : (
                <LocationBars slices={byLocation.data.slices} currency={currency} />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---- Alert feed ---- */}
        <Card>
          <CardHeader
            title="Anomaly feed"
            description="Unacknowledged alerts, newest first"
            action={
              <Link
                href="/alerts"
                className="flex items-center gap-0.5 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
              >
                View all
                <IconChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {alerts.error ? (
            <ErrorState onRetry={() => alerts.mutate()} compact />
          ) : !alerts.data ? (
            <div className="divide-y divide-line">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.data.alerts.length === 0 ? (
            <EmptyState
              icon={<IconInbox className="h-5 w-5" />}
              title="No open alerts"
              description="Every device is running within its expected envelope. New anomalies appear here the moment they're detected."
            />
          ) : (
            <div className="divide-y divide-line">
              {alerts.data.alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={acknowledge}
                  acknowledging={acknowledging === alert.id}
                  compact
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

const GRANULARITY_LABEL: Record<string, string> = {
  interval: '15-minute intervals',
  hour: 'hourly',
  day: 'daily',
};
