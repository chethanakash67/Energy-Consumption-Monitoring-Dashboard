'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer for the desktop table. */
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Hidden below this breakpoint on desktop; always shown in the card view. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Omit from the stacked mobile card (e.g. a redundant name column). */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Rendered as the headline of each stacked mobile card. */
  mobileTitle?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}

const HIDE_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * Responsive data table.
 *
 * Renders a real `<table>` at `md` and above, and a stack of cards below it —
 * horizontally scrolling a six-column table on a phone is worse than
 * re-flowing it, so the component ships both layouts rather than compromising.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  mobileTitle,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={className}>
      {/* ---- Desktop ---- */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-2xs font-medium uppercase tracking-wide text-ink-muted sm:px-5',
                  column.align === 'right' ? 'text-right' : 'text-left',
                  column.hideBelow && HIDE_CLASS[column.hideBelow],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              // A clickable row must also be reachable by keyboard, or the
              // whole table becomes mouse-only.
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'transition-all duration-150',
                onRowClick &&
                  'cursor-pointer hover:bg-surface-subtle/70 hover:shadow-[inset_2px_0_0_var(--brand)] focus-visible:bg-surface-subtle',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-3 align-middle sm:px-5',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.hideBelow && HIDE_CLASS[column.hideBelow],
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- Mobile ---- */}
      <div className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'button' : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              'px-4 py-3.5 transition-colors duration-150',
              onRowClick && 'cursor-pointer active:bg-surface-subtle',
            )}
          >
            {mobileTitle ? <div className="mb-2.5">{mobileTitle(row)}</div> : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <Fragment key={column.key}>
                    <dt className="text-2xs uppercase tracking-wide text-ink-muted">
                      {column.header}
                    </dt>
                    <dd className="text-right text-xs text-ink">{column.cell(row)}</dd>
                  </Fragment>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
