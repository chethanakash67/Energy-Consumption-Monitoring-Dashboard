'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

/** Pre-seeded accounts, offered as one-click fills for reviewers. */
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@voltiq.io', password: 'admin1234' },
  { label: 'Viewer', email: 'viewer@voltiq.io', password: 'viewer1234' },
];

export default function LoginPage() {
  const { login, user, loading: sessionLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // An already-authenticated visitor should never see the login form.
  useEffect(() => {
    if (!sessionLoading && user) router.replace('/dashboard');
  }, [user, sessionLoading, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await login(email, password);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError('Could not reach the API. Is the backend running on port 4000?');
      }
      setSubmitting(false);
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Sign in to monitor your estate&apos;s energy use.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          required
        />

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5"
          >
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical"
              viewBox="0 0 14 14"
              fill="currentColor"
              aria-hidden
            >
              <path d="M7 0a7 7 0 100 14A7 7 0 007 0zm.9 10.5h-1.8V8.7h1.8v1.8zm0-3H6.1v-4h1.8v4z" />
            </svg>
            <p className="text-xs leading-relaxed text-critical-fg">{error}</p>
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-line bg-surface-subtle/60 p-3.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Demo accounts
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-all duration-150 ease-smooth hover:border-brand hover:text-brand"
            >
              {account.label}
              <span className="ml-1.5 font-normal text-ink-muted">{account.email}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-brand transition-colors hover:text-brand-hover"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
