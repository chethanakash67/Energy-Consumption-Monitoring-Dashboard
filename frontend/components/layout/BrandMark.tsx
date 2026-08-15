import { cn } from '@/lib/utils';

/**
 * Product logotype: a bolt rendered as a stylised meter needle inside a
 * rounded square, paired with the wordmark.
 */
export function BrandMark({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}) {
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-8 w-8';
  const text = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg text-white shadow-glow-brand-sm',
          box,
        )}
        style={{
          background: 'linear-gradient(140deg, var(--series-1) 0%, var(--series-5) 100%)',
        }}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]'}
          aria-hidden
        >
          <path
            d="M11.2 2.5 4.8 11.1a.6.6 0 0 0 .48.96h3.4l-.88 5.44a.6.6 0 0 0 1.08.44l6.4-8.6a.6.6 0 0 0-.48-.96h-3.4l.88-5.44a.6.6 0 0 0-1.08-.44Z"
            fill="currentColor"
          />
        </svg>
      </div>
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight text-ink', text)}>Voltiq</span>
      ) : null}
    </div>
  );
}
