'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

/** Simple strength meter — length plus character-class variety. */
function passwordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (password.length < 8) return { score: 0, label: 'Too short' };

  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/\d/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  if (password.length >= 12 && variety >= 3) return { score: 3, label: 'Strong' };
  if (variety >= 2) return { score: 2, label: 'Good' };
  return { score: 1, label: 'Weak' };
}

const STRENGTH_TONE = ['bg-line-strong', 'bg-critical', 'bg-elevated', 'bg-optimal'];

export default function SignupPage() {
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = passwordStrength(password);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await signup(name, email, password);
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

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        New accounts join as viewers. An administrator can promote you later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
          required
        />

        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          required
        />

        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />
          {password ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      index < strength.score ? STRENGTH_TONE[strength.score] : 'bg-line-strong',
                    )}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-2xs text-ink-muted">{strength.label}</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed text-critical-fg">{error}</p>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={strength.score === 0}
          className="w-full"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-brand transition-colors hover:text-brand-hover"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
