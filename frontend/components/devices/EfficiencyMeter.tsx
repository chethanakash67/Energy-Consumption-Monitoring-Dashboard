import { cn } from '@/lib/utils';

/**
 * Efficiency score as a compact 4-segment meter plus its numeric value.
 *
 * The number is always shown — the segments are a glanceable summary, not the
 * only way to read the value.
 */
export function EfficiencyMeter({
  score,
  showLabel = true,
  className,
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const filled = Math.ceil((score / 100) * 4);

  const tone =
    score >= 75 ? 'optimal' : score >= 50 ? 'elevated' : score >= 25 ? 'high' : 'critical';

  const TONE_BG = {
    optimal: 'bg-optimal shadow-[0_0_6px_0_var(--glow-optimal)]',
    elevated: 'bg-elevated shadow-[0_0_6px_0_var(--glow-elevated)]',
    high: 'bg-high shadow-[0_0_6px_0_var(--glow-high)]',
    critical: 'bg-critical shadow-[0_0_6px_0_var(--glow-critical)]',
  } as const;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-3 w-1 rounded-full transition-all duration-300',
              segment <= filled ? TONE_BG[tone] : 'bg-surface-inset',
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span className="text-xs font-medium text-ink tnum">{score}</span>
      ) : null}
      <span className="sr-only">Efficiency score {score} out of 100</span>
    </span>
  );
}
