import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The base surface every panel in the product sits on. */
export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'glass glass-edge rounded-lg shadow-xs',
        interactive &&
          'transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-glow-brand',
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls — range toggles, menus, links. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-t border-line bg-surface-subtle/50 px-4 py-3 sm:px-5', className)}
      {...props}
    />
  );
}
