'use client';

import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; title?: string }[];
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/**
 * Compact single-select used for time ranges and chart-mode toggles.
 *
 * The selected pill is a real element rather than a background class, so it
 * can slide between options instead of hard-cutting.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-md border border-line bg-surface-subtle p-0.5',
        className,
      )}
    >
      {/* Sliding indicator sits behind the labels. */}
      <span
        aria-hidden
        className="glass absolute top-0.5 rounded-[5px] shadow-glow-brand-sm transition-transform duration-200 ease-smooth"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          height: 'calc(100% - 4px)',
          transform: `translateX(calc(${selectedIndex} * 100%))`,
          left: '2px',
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex-1 whitespace-nowrap rounded-[5px] font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
