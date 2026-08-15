'use client';

import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

/**
 * Empty and error states.
 *
 * Designed with the same care as the happy path: an icon, a plain-language
 * explanation of *why* the surface is blank, and — where one exists — the
 * action that fills it.
 */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-subtle text-ink-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? (
        <Button size="sm" variant="secondary" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = "Couldn't load this data",
  description = 'The request failed. This is usually a dropped connection to the API.',
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-critical-subtle text-critical shadow-glow-critical">
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M10 6.5v4" strokeLinecap="round" />
          <circle cx="10" cy="13.6" r="0.9" fill="currentColor" stroke="none" />
          <path
            d="M8.6 2.9 1.9 15.2a1.6 1.6 0 0 0 1.4 2.4h13.4a1.6 1.6 0 0 0 1.4-2.4L11.4 2.9a1.6 1.6 0 0 0-2.8 0Z"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
