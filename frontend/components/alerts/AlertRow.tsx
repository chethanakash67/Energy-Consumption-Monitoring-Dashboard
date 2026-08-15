'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ALERT_TYPE_META, SEVERITY_META } from '@/lib/constants';
import { formatEnergy, formatRelative } from '@/lib/format';
import type { Alert } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * One alert in a feed or table.
 *
 * Severity is carried by an icon, a label, and a colour together — never by
 * colour alone.
 */
export function AlertRow({
  alert,
  onAcknowledge,
  acknowledging,
  compact = false,
}: {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  acknowledging?: boolean;
  compact?: boolean;
}) {
  const severity = SEVERITY_META[alert.severity];

  return (
    <div
      className={cn(
        'group flex gap-3 transition-colors duration-150',
        compact ? 'px-4 py-3 sm:px-5' : 'px-4 py-3.5 sm:px-5',
        'hover:bg-surface-subtle/60',
        alert.acknowledged && 'opacity-60',
      )}
    >
      <SeverityIcon severity={alert.severity} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/devices/${alert.deviceId}`}
            className="truncate text-sm font-medium text-ink transition-colors hover:text-brand"
          >
            {alert.device.name}
          </Link>
          <Badge tone={severity.tone}>{severity.label}</Badge>
          {!compact ? (
            <Badge tone="neutral">{ALERT_TYPE_META[alert.type].label}</Badge>
          ) : null}
        </div>

        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{alert.message}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-muted">
          <span>{alert.device.location.name}</span>
          <span aria-hidden>·</span>
          <time dateTime={alert.timestamp}>{formatRelative(alert.timestamp)}</time>
          {alert.baseline != null ? (
            <>
              <span aria-hidden>·</span>
              <span className="tnum">
                {formatEnergy(Math.abs(alert.value))} vs {formatEnergy(Math.abs(alert.baseline))}{' '}
                expected
              </span>
            </>
          ) : null}
          {alert.acknowledged && alert.acknowledgedBy ? (
            <>
              <span aria-hidden>·</span>
              <span>Acknowledged by {alert.acknowledgedBy.name}</span>
            </>
          ) : null}
        </div>
      </div>

      {!alert.acknowledged && onAcknowledge ? (
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          disabled={acknowledging}
          className={cn(
            'h-7 shrink-0 self-start rounded-md border border-line bg-surface px-2.5 text-2xs font-medium text-ink-secondary',
            'transition-all duration-150 ease-smooth',
            'hover:border-brand hover:text-brand disabled:opacity-50',
            // Revealed on hover at desktop widths; always visible on touch.
            'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100',
          )}
        >
          {acknowledging ? 'Saving…' : 'Acknowledge'}
        </button>
      ) : null}
    </div>
  );
}

function SeverityIcon({ severity }: { severity: Alert['severity'] }) {
  const tone = SEVERITY_META[severity].tone;

  return (
    <div
      className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        tone === 'critical' && 'bg-critical-subtle text-critical shadow-[0_0_10px_-1px_var(--glow-critical)]',
        tone === 'high' && 'bg-high-subtle text-high shadow-[0_0_10px_-1px_var(--glow-high)]',
        tone === 'elevated' && 'bg-elevated-subtle text-elevated shadow-[0_0_10px_-1px_var(--glow-elevated)]',
      )}
    >
      {severity === 'CRITICAL' ? (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path
            d="M6.9 2.4 1.5 12.2a1.3 1.3 0 0 0 1.1 2h10.8a1.3 1.3 0 0 0 1.1-2L9.1 2.4a1.3 1.3 0 0 0-2.2 0Z"
            strokeLinejoin="round"
          />
          <path d="M8 6.2v3.1" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M2 11.5 5.8 7l2.6 2.6L14 3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.4 3.5H14v3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
