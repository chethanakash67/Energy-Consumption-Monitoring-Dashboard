'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { formatCarbon, formatCurrency, formatEnergy, formatPercent } from '@/lib/format';
import type { Summary } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * This period vs the previous equal-length period.
 *
 * Each row shows both absolute figures and the delta, rather than the delta
 * alone — a "-5.6%" with no magnitude behind it can't be acted on.
 */
export function PeriodComparison({
  summary,
  error,
  onRetry,
  comparisonLabel,
  currency,
}: {
  summary?: Summary;
  error: boolean;
  onRetry: () => void;
  comparisonLabel: string;
  currency: string;
}) {
  if (error) {
    return (
      <Card>
        <ErrorState onRetry={onRetry} compact />
      </Card>
    );
  }

  const rows = summary
    ? [
        {
          label: 'Consumption',
          current: formatEnergy(summary.current.netKwh, { decimals: 1 }),
          previous: formatEnergy(summary.previous.netKwh, { decimals: 1 }),
          change: summary.change.netKwh,
        },
        {
          label: 'Cost',
          current: formatCurrency(summary.current.cost, currency),
          previous: formatCurrency(summary.previous.cost, currency),
          change: summary.change.cost,
        },
        {
          label: 'Carbon',
          current: formatCarbon(summary.current.carbonKg),
          previous: formatCarbon(summary.previous.carbonKg),
          change: summary.change.carbonKg,
        },
        {
          label: 'Solar generated',
          current: formatEnergy(summary.current.generationKwh, { decimals: 1 }),
          previous: formatEnergy(summary.previous.generationKwh, { decimals: 1 }),
          // More generation is good, so this row inverts the tone.
          change:
            summary.previous.generationKwh === 0
              ? 0
              : ((summary.current.generationKwh - summary.previous.generationKwh) /
                  summary.previous.generationKwh) *
                100,
          higherIsBetter: true,
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader
        title="Period comparison"
        description={`Current range ${comparisonLabel.replace('vs ', 'vs the ')}`}
      />
      <CardBody>
        {!summary ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => {
              const rising = row.change > 0;
              const flat = Math.abs(row.change) < 0.05;
              const good = row.higherIsBetter ? rising : !rising;

              return (
                <div key={row.label}>
                  <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
                    {row.label}
                  </p>
                  <p className="mt-1.5 font-numeric text-2xl font-semibold tracking-tight text-ink">
                    {row.current}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-2xs font-semibold tnum',
                        flat
                          ? 'bg-surface-subtle text-ink-secondary'
                          : good
                            ? 'bg-optimal-subtle text-optimal-fg'
                            : 'bg-critical-subtle text-critical-fg',
                      )}
                    >
                      {flat ? '—' : formatPercent(row.change)}
                    </span>
                    <span className="text-2xs text-ink-muted">from {row.previous}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
