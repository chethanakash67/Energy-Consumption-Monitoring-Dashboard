'use client';

import { useToast, type ToastTone } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * Toast viewport.
 *
 * Bottom-right on desktop, top on mobile (where the bottom edge collides with
 * browser chrome and the mobile nav).
 */
const TONE_STYLES: Record<ToastTone, { bar: string; icon: string; iconBg: string }> = {
  info: { bar: 'bg-brand shadow-[0_0_10px_1px_var(--glow-brand)]', icon: 'text-brand', iconBg: 'bg-brand-subtle' },
  success: {
    bar: 'bg-optimal shadow-[0_0_10px_1px_var(--glow-optimal)]',
    icon: 'text-optimal',
    iconBg: 'bg-optimal-subtle',
  },
  elevated: {
    bar: 'bg-elevated shadow-[0_0_10px_1px_var(--glow-elevated)]',
    icon: 'text-elevated',
    iconBg: 'bg-elevated-subtle',
  },
  critical: {
    bar: 'bg-critical shadow-[0_0_10px_1px_var(--glow-critical)]',
    icon: 'text-critical',
    iconBg: 'bg-critical-subtle',
  },
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="m3.5 8.5 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === 'info') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 7.2v4" strokeLinecap="round" />
        <circle cx="8" cy="4.9" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // elevated + critical share the warning triangle.
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.9 2.4 1.5 12.2A1.3 1.3 0 0 0 2.6 14.2h10.8a1.3 1.3 0 0 0 1.1-2L9.1 2.4a1.3 1.3 0 0 0-2.2 0Z" strokeLinejoin="round" />
      <path d="M8 6.2v3.1" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const styles = TONE_STYLES[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === 'critical' ? 'assertive' : 'polite'}
            className="glass-strong glass-edge pointer-events-auto flex w-full max-w-sm animate-slide-in-right overflow-hidden rounded-lg shadow-pop"
          >
            <div className={cn('w-1 shrink-0', styles.bar)} />
            <div className="flex min-w-0 flex-1 gap-3 p-3.5">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  styles.iconBg,
                  styles.icon,
                )}
              >
                <span className="block h-4 w-4">
                  <ToneIcon tone={toast.tone} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-ink">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                    {toast.description}
                  </p>
                ) : null}
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="mt-2 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
                  >
                    {toast.action.label} →
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 h-6 w-6 shrink-0 rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
              >
                <svg
                  className="mx-auto h-3.5 w-3.5"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  <path d="m3.5 3.5 7 7M10.5 3.5l-7 7" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
