import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/BrandMark';

/**
 * Split layout for login/signup: the form on the left, a product-value panel
 * on the right that collapses away below `lg`.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-[52%] lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <BrandMark size="md" className="mb-10" />
          {children}
        </div>
      </div>

      <aside className="glass relative hidden overflow-hidden border-y-0 border-r-0 lg:flex lg:w-[48%] lg:flex-col lg:justify-center lg:px-16 xl:px-20">
        <AuroraBackdrop />
        <div className="relative animate-fade-in">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-brand">
            Energy intelligence
          </p>
          <h2
            className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight text-ink"
            style={{ textShadow: '0 0 40px var(--text-glow-brand)' }}
          >
            Every kilowatt-hour, accounted for.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-secondary">
            Voltiq streams meter data from every device on your estate, flags the
            anomalies that cost you money, and turns 60 days of history into a
            forecast you can act on.
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-2 gap-x-6 gap-y-7">
            <Stat value="15 min" label="Metering interval" />
            <Stat value="Real time" label="Live usage stream" live />
            <Stat value="Automatic" label="Anomaly detection" />
            <Stat value="CSV" label="Exportable reports" />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Stat({ value, label, live }: { value: string; label: string; live?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-numeric text-xl font-semibold tracking-tight text-ink">
        {value}
        {live ? (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-optimal opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-optimal shadow-[0_0_6px_1px_var(--glow-optimal)]" />
          </span>
        ) : null}
      </dt>
      <dd className="mt-0.5 text-xs text-ink-muted">{label}</dd>
    </div>
  );
}

/** Aurora blobs + a faint chart grid + scanlines; purely decorative. */
function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full opacity-90 blur-3xl animate-aurora"
        style={{ background: 'radial-gradient(circle, var(--ambient-1), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full opacity-80 blur-3xl animate-aurora [animation-delay:-4.5s]"
        style={{ background: 'radial-gradient(circle, var(--ambient-3), transparent 70%)' }}
      />
      {/* Faint grid, echoing the chart plane. */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(var(--chart-grid) 1px, transparent 1px), linear-gradient(90deg, var(--chart-grid) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />
      <div className="scanlines absolute inset-0" />
    </div>
  );
}
