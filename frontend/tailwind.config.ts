import type { Config } from 'tailwindcss';

/**
 * Every colour here resolves to a CSS custom property defined in
 * `app/globals.css`. Tailwind never holds a literal hex, so light/dark theming
 * happens in one place and no utility class can drift off-palette.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
          subtle: 'var(--bg-subtle)',
          inset: 'var(--bg-inset)',
        },
        line: {
          DEFAULT: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          subtle: 'var(--brand-subtle)',
          ring: 'var(--brand-ring)',
          fg: 'var(--brand-fg)',
        },
        // Semantic energy states. Deliberately not generic red/yellow/green:
        // "optimal" is a cool jade, "elevated" a deep amber, "high" a burnt
        // orange, "critical" a muted crimson.
        optimal: {
          DEFAULT: 'var(--status-optimal)',
          subtle: 'var(--status-optimal-subtle)',
          fg: 'var(--status-optimal-fg)',
        },
        elevated: {
          DEFAULT: 'var(--status-elevated)',
          subtle: 'var(--status-elevated-subtle)',
          fg: 'var(--status-elevated-fg)',
        },
        high: {
          DEFAULT: 'var(--status-high)',
          subtle: 'var(--status-high-subtle)',
          fg: 'var(--status-high-fg)',
        },
        critical: {
          DEFAULT: 'var(--status-critical)',
          subtle: 'var(--status-critical-subtle)',
          fg: 'var(--status-critical-fg)',
        },
        series: {
          1: 'var(--series-1)',
          2: 'var(--series-2)',
          3: 'var(--series-3)',
          4: 'var(--series-4)',
          5: 'var(--series-5)',
          6: 'var(--series-6)',
          7: 'var(--series-7)',
          8: 'var(--series-8)',
        },
        grid: 'var(--chart-grid)',
        axis: 'var(--chart-axis)',
        glass: {
          DEFAULT: 'var(--glass-bg)',
          strong: 'var(--glass-bg-strong)',
          border: 'var(--glass-border)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Reserved for large numeric displays (KPI values, hero figures).
        numeric: ['var(--font-numeric)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
        '3xl': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
        '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        pop: 'var(--shadow-pop)',
        'glow-brand': '0 0 0 1px var(--glow-brand), 0 16px 40px -12px var(--glow-brand)',
        'glow-optimal': '0 0 0 1px var(--glow-optimal), 0 16px 40px -12px var(--glow-optimal)',
        'glow-elevated': '0 0 0 1px var(--glow-elevated), 0 16px 40px -12px var(--glow-elevated)',
        'glow-high': '0 0 0 1px var(--glow-high), 0 16px 40px -12px var(--glow-high)',
        'glow-critical': '0 0 0 1px var(--glow-critical), 0 16px 40px -12px var(--glow-critical)',
        'glow-brand-sm': '0 0 16px -2px var(--glow-brand)',
        'glow-optimal-sm': '0 0 14px -2px var(--glow-optimal)',
      },
      transitionTimingFunction: {
        // A gentle overshoot-free curve used for every hover/enter transition.
        smooth: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        aurora: {
          from: { transform: 'translate3d(0, 0, 0) scale(1)' },
          to: { transform: 'translate3d(-4%, 4%, 0) scale(1.08)' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-up': 'slide-up 0.32s cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.32, 0.72, 0, 1) both',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.32, 0.72, 0, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        aurora: 'aurora 9s ease-in-out infinite alternate',
        'glow-breathe': 'glow-breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
