'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { IconMoon, IconSun } from '@/components/layout/Icons';
import { cn } from '@/lib/utils';

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  { value: 'light', label: 'Light', description: 'Always light' },
  { value: 'dark', label: 'Dark', description: 'Always dark' },
  { value: 'system', label: 'System', description: 'Match your OS' },
];

export function AppearanceSettings() {
  const { preference, resolved, setPreference } = useTheme();
  const { user, updateUser } = useAuth();

  function choose(next: ThemePreference) {
    setPreference(next);
    if (!user) return;
    updateUser({ theme: next });
    apiFetch('/api/auth/me', { method: 'PATCH', body: { theme: next } }).catch(() => {});
  }

  return (
    <Card>
      <CardHeader
        title="Appearance"
        description="Your theme preference is saved to your account"
      />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={selected}
                className={cn(
                  'group rounded-lg border p-3 text-left transition-all duration-200 ease-smooth',
                  selected
                    ? 'border-brand bg-brand-subtle shadow-glow-brand-sm'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-subtle',
                )}
              >
                {/* Miniature of the theme, so the choice is visual not verbal. */}
                <ThemeSwatch
                  variant={
                    option.value === 'system' ? (resolved === 'dark' ? 'dark' : 'light') : option.value
                  }
                  split={option.value === 'system'}
                />

                <div className="mt-3 flex items-center gap-1.5">
                  {option.value === 'dark' ? (
                    <IconMoon className="h-3.5 w-3.5 text-ink-muted" />
                  ) : option.value === 'light' ? (
                    <IconSun className="h-3.5 w-3.5 text-ink-muted" />
                  ) : null}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      selected ? 'text-brand' : 'text-ink',
                    )}
                  >
                    {option.label}
                  </span>
                </div>
                <p className="mt-0.5 text-2xs text-ink-muted">{option.description}</p>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

/** Tiny abstract preview of a dashboard in the given theme. */
function ThemeSwatch({ variant, split }: { variant: 'light' | 'dark'; split?: boolean }) {
  const isDark = variant === 'dark';

  return (
    <div
      className="relative h-16 w-full overflow-hidden rounded-md border border-line"
      style={{ backgroundColor: isDark ? '#0a0c10' : '#f5f6f9' }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 h-full w-1/4"
        style={{ backgroundColor: isDark ? '#131519' : '#ffffff' }}
      />
      <div className="absolute left-[30%] right-2 top-2 space-y-1.5">
        <div
          className="h-2 w-full rounded-sm"
          style={{ backgroundColor: isDark ? '#191c22' : '#ffffff' }}
        />
        <div className="h-5 w-full rounded-sm" style={{ backgroundColor: isDark ? '#191c22' : '#ffffff' }}>
          <div
            className="ml-1 mt-1 h-3 w-1/2 rounded-[2px]"
            style={{ backgroundColor: isDark ? '#5a80f0' : '#3b6fe0' }}
          />
        </div>
      </div>
      {split ? (
        <div
          className="absolute inset-y-0 right-0 w-1/2"
          style={{
            backgroundColor: isDark ? '#f5f6f9' : '#0a0c10',
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
            opacity: 0.9,
          }}
        />
      ) : null}
    </div>
  );
}
