'use client';

import { useTheme, type ThemePreference } from '@/lib/theme';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { IconMoon, IconSun } from './Icons';
import { cn } from '@/lib/utils';

/**
 * Light/dark toggle.
 *
 * Flips between explicit light and dark (never back to "system") — the
 * three-way choice lives in Settings, where there's room to explain it. The
 * new preference is persisted to the user's profile so it follows them
 * across devices.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const { user, updateUser } = useAuth();

  const next: ThemePreference = resolved === 'dark' ? 'light' : 'dark';

  function toggle() {
    setPreference(next);
    if (!user) return;

    updateUser({ theme: next });
    // Fire-and-forget: a failed persist shouldn't block the visual change.
    apiFetch('/api/auth/me', { method: 'PATCH', body: { theme: next } }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-md text-ink-muted',
        'transition-colors duration-150 ease-smooth hover:bg-surface-subtle hover:text-ink',
        className,
      )}
    >
      <IconSun
        className={cn(
          'absolute h-[18px] w-[18px] transition-all duration-300 ease-smooth',
          resolved === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
        )}
      />
      <IconMoon
        className={cn(
          'absolute h-[18px] w-[18px] transition-all duration-300 ease-smooth',
          resolved === 'dark' ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
      />
    </button>
  );
}
