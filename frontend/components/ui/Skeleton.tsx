import { cn } from '@/lib/utils';

/**
 * Loading placeholders.
 *
 * Every async surface uses a skeleton shaped like its real content rather than
 * a spinner, so the layout doesn't jump when data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Matches the KPI card's internal rhythm so the swap is near-invisible. */
export function SkeletonKpi() {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

/** Bars of pseudo-random height, so it reads as a chart rather than a block. */
export function SkeletonChart({ height = 280 }: { height?: number }) {
  const heights = [42, 68, 55, 78, 48, 88, 62, 72, 50, 84, 58, 76, 46, 66, 80];

  return (
    <div className="flex items-end gap-1.5 px-1" style={{ height }}>
      {heights.map((value, index) => (
        <div
          key={index}
          className="skeleton flex-1 rounded-t-sm"
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5', columnIndex === 0 ? 'w-1/3' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
