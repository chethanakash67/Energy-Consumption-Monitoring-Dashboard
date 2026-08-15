'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { formatCurrency, formatEnergy } from '@/lib/format';
import type { Projection } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Month-end cost projection.
 *
 * A straight-line extrapolation of the month-to-date run rate. The method is
 * stated on the card and the elapsed fraction is shown, because a projection
 * made three days into a month deserves far less trust than one made on the
 * 25th — hiding that would make the number look more certain than it is.
 */
export function ProjectionCard({
  projection,
  error,
  onRetry,
}: {
  projection?: Projection;
  error: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader title="Cost projection" />
        <ErrorState onRetry={onRetry} compact />
      </Card>
    );
  }

  if (!projection) {
    return (
      <Card>
        <CardHeader title="Cost projection" description="Projected spend for this month" />
        <CardBody className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardBody>
      </Card>
    );
  }

  const { currency } = projection;
  const progress = Math.min(100, (projection.daysElapsed / projection.daysInMonth) * 100);

  const versusLastMonth =
    projection.previousMonthCost > 0
      ? ((projection.projectedCost - projection.previousMonthCost) /
          projection.previousMonthCost) *
        100
      : 0;

  // Under ~20% of the month elapsed, a linear projection is mostly noise.
  const lowConfidence = progress < 20;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Cost projection" description="Straight-line month-end estimate" />
      <CardBody className="flex flex-1 flex-col">
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Projected month-end
        </p>
        <p className="mt-1.5 font-numeric text-4xl font-semibold leading-none tracking-tight text-ink">
          {formatCurrency(projection.projectedCost, currency)}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold tnum',
              versusLastMonth > 0
                ? 'bg-critical-subtle text-critical-fg'
                : 'bg-optimal-subtle text-optimal-fg',
            )}
          >
            {versusLastMonth > 0 ? '+' : ''}
            {versusLastMonth.toFixed(1)}%
          </span>
          <span className="text-2xs text-ink-muted">
            vs {formatCurrency(projection.previousMonthCost, currency)} last month
          </span>
        </div>

        {/* Month progress — the basis for the extrapolation. */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-2xs text-ink-muted">
              Day {Math.floor(projection.daysElapsed)} of {projection.daysInMonth}
            </span>
            <span className="text-2xs font-medium text-ink-secondary tnum">
              {formatCurrency(projection.monthToDateCost, currency)} so far
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full bg-brand transition-all duration-700 ease-smooth"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <dl className="mt-5 space-y-2.5 border-t border-line pt-4">
          <Row
            label="Daily run rate"
            value={formatCurrency(projection.dailyRunRateCost, currency)}
          />
          <Row
            label="Month-to-date energy"
            value={formatEnergy(projection.monthToDateKwh, { decimals: 1 })}
          />
          <Row
            label="Projected energy"
            value={formatEnergy(projection.projectedKwh, { decimals: 1 })}
          />
        </dl>

        {lowConfidence ? (
          <p className="mt-4 rounded-md bg-elevated-subtle px-3 py-2 text-2xs leading-relaxed text-elevated-fg">
            Only {progress.toFixed(0)}% of the month has elapsed — this projection will
            firm up as more days are recorded.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-xs font-semibold text-ink tnum">{value}</dd>
    </div>
  );
}
