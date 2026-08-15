'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Input } from '@/components/ui/Field';
import { Skeleton, SkeletonChart } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ComparisonChart } from '@/components/charts/ComparisonChart';
import { PeakHeatmap } from '@/components/charts/PeakHeatmap';
import { ProjectionCard } from '@/components/analytics/ProjectionCard';
import { PeriodComparison } from '@/components/analytics/PeriodComparison';
import { RealtimeInsights } from '@/components/analytics/RealtimeInsights';
import { IconAnalytics, IconDownload } from '@/components/layout/Icons';
import { RANGE_OPTIONS } from '@/lib/constants';
import { useRange } from '@/lib/useRange';
import { buildQuery, downloadFile } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type {
  ComparisonSeries,
  Granularity,
  HeatmapCell,
  Projection,
  RangeKey,
  Summary,
} from '@/lib/types';

type Dimension = 'device' | 'location';

export default function AnalyticsPage() {
  const { range, query, from, to, setPreset, setCustom, comparisonLabel } = useRange('30d');
  const [dimension, setDimension] = useState<Dimension>('location');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const realtimeQuery = `${query}&source=realtime`;

  const summary = useSWR<Summary>(`/api/analytics/summary?${realtimeQuery}`);
  const comparison = useSWR<{ granularity: Granularity; series: ComparisonSeries[] }>(
    `/api/analytics/comparison?dimension=${dimension}&${realtimeQuery}`,
  );
  const heatmap = useSWR<{ cells: HeatmapCell[] }>(`/api/analytics/heatmap?${realtimeQuery}`);
  const projection = useSWR<Projection>(`/api/analytics/projection?${buildQuery({})}`);

  const currency = summary.data?.currency ?? 'USD';

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile(
        `/api/analytics/export?${realtimeQuery}`,
        `voltiq-report-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`,
      );
      toast({
        title: 'Report downloaded',
        description: 'Raw 15-minute readings for the selected range.',
        tone: 'success',
        duration: 4000,
      });
    } catch {
      toast({
        title: 'Export failed',
        description: 'The report could not be generated. Please try again.',
        tone: 'critical',
      });
    } finally {
      setExporting(false);
    }
  }

  /** `<input type="date">` wants YYYY-MM-DD in local time. */
  const toDateInput = (date: Date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  function applyCustomRange(fromValue: string, toValue: string) {
    if (!fromValue || !toValue) return;
    // Extend the end date to the close of that day so it's inclusive.
    const end = new Date(`${toValue}T23:59:59`);
    setCustom(new Date(`${fromValue}T00:00:00`).toISOString(), end.toISOString());
  }

  return (
    <AppShell
      title="Analytics"
      description="Compare periods, find peaks, and project spend"
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={<IconDownload className="h-4 w-4" />}
          onClick={exportCsv}
          loading={exporting}
        >
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ---- Range controls, in one row above the charts ---- */}
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Time range
              </p>
              <SegmentedControl
                aria-label="Time range"
                value={range.key === 'custom' ? 'custom' : range.key}
                onChange={(value) => setPreset(value as RangeKey)}
                options={[
                  ...RANGE_OPTIONS.map(({ value, label, description }) => ({
                    value: value as RangeKey,
                    label,
                    title: description,
                  })),
                  ...(range.key === 'custom'
                    ? [{ value: 'custom' as RangeKey, label: 'Custom' }]
                    : []),
                ]}
                size="md"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                label="From"
                type="date"
                defaultValue={toDateInput(from)}
                max={toDateInput(to)}
                onChange={(event) =>
                  applyCustomRange(event.target.value, toDateInput(to))
                }
                className="sm:w-40"
              />
              <Input
                label="To"
                type="date"
                defaultValue={toDateInput(to)}
                onChange={(event) =>
                  applyCustomRange(toDateInput(from), event.target.value)
                }
                className="sm:w-40"
              />
            </div>
          </CardBody>
        </Card>

        {/* ---- Period comparison ---- */}
        <PeriodComparison
          summary={summary.data}
          error={Boolean(summary.error)}
          onRetry={() => summary.mutate()}
          comparisonLabel={comparisonLabel}
          currency={currency}
        />

        <RealtimeInsights currency={currency} />

        {/* ---- Comparative analysis ---- */}
        <Card>
          <CardHeader
            title="Comparative analysis"
            description={
              dimension === 'location'
                ? 'Consumption per site over the selected range'
                : 'Consumption per device over the selected range'
            }
            action={
              <SegmentedControl
                aria-label="Compare by"
                value={dimension}
                onChange={setDimension}
                options={[
                  { value: 'location', label: 'By location' },
                  { value: 'device', label: 'By device' },
                ]}
              />
            }
          />
          <CardBody>
            {comparison.error ? (
              <ErrorState onRetry={() => comparison.mutate()} compact />
            ) : !comparison.data ? (
              <>
                <Skeleton className="mb-4 h-3 w-72" />
                <SkeletonChart height={320} />
              </>
            ) : comparison.data.series.length === 0 ? (
              <EmptyState
                icon={<IconAnalytics className="h-5 w-5" />}
                title="Nothing to compare"
                description="No readings fall inside this range. Widen the window and try again."
              />
            ) : (
              <ComparisonChart
                series={comparison.data.series}
                granularity={comparison.data.granularity}
              />
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* ---- Heatmap ---- */}
          <Card className="xl:col-span-2">
            <CardHeader
              title="Peak usage pattern"
              description="Average consumption by hour of day and day of week"
            />
            <CardBody>
              {heatmap.error ? (
                <ErrorState onRetry={() => heatmap.mutate()} compact />
              ) : !heatmap.data ? (
                <div className="space-y-1">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-5 w-full" />
                  ))}
                </div>
              ) : heatmap.data.cells.length === 0 ? (
                <EmptyState title="No data in this range" compact />
              ) : (
                <PeakHeatmap cells={heatmap.data.cells} />
              )}
            </CardBody>
          </Card>

          {/* ---- Projection ---- */}
          <ProjectionCard
            projection={projection.data}
            error={Boolean(projection.error)}
            onRetry={() => projection.mutate()}
          />
        </div>
      </div>
    </AppShell>
  );
}
