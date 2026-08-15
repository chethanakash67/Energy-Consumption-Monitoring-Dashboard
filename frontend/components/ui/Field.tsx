'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const CONTROL_BASE =
  'w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted ' +
  'transition-all duration-150 ease-smooth ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-brand focus:shadow-glow-brand-sm ' +
  'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, so every form row is spaced identically. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-secondary">
          {label}
          {required ? <span className="ml-0.5 text-critical">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-critical-fg">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M6 0a6 6 0 100 12A6 6 0 006 0zm.75 9h-1.5V7.5h1.5V9zm0-2.5h-1.5V3h1.5v3.5z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// `prefix` is a (legacy) HTML attribute typed as `string`, so it has to be
// omitted before being redeclared as a ReactNode adornment.
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  /** Leading adornment, e.g. a currency symbol or search icon. */
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, suffix, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-ink-muted">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL_BASE,
            'h-9',
            error ? 'border-critical focus:border-critical focus:ring-critical/30' : 'border-line',
            prefix && 'pl-8',
            suffix && 'pr-12',
            className,
          )}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={cn(
            CONTROL_BASE,
            'h-9 cursor-pointer appearance-none pr-9',
            error ? 'border-critical' : 'border-line',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="m3.5 5.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Field>
  );
});

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-4',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-medium text-ink">{label}</span> : null}
          {description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-all duration-200 ease-smooth',
          checked ? 'bg-brand shadow-glow-brand-sm' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-smooth',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
          style={{ transform: `translateX(${checked ? 18 : 2}px)` }}
        />
      </button>
    </label>
  );
}
