/**
 * Fixed, decorative aurora blobs behind the app shell.
 *
 * Purely visual — the glass surfaces above (sidebar, header, cards) pick up
 * their colour through `backdrop-filter`. Faint in light mode, brighter and
 * paired with a scanline overlay in dark mode, where "Glass Control Room"
 * actually lives.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-24 -top-32 h-[34rem] w-[34rem] rounded-full opacity-70 blur-[110px] animate-aurora"
        style={{ background: 'radial-gradient(circle, var(--ambient-1), transparent 70%)' }}
      />
      <div
        className="absolute -right-28 top-1/4 h-[30rem] w-[30rem] rounded-full opacity-60 blur-[110px] animate-aurora [animation-delay:-3s]"
        style={{ background: 'radial-gradient(circle, var(--ambient-3), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full opacity-50 blur-[110px] animate-aurora [animation-delay:-6s]"
        style={{ background: 'radial-gradient(circle, var(--ambient-2), transparent 70%)' }}
      />
      <div className="scanlines absolute inset-0" />
    </div>
  );
}
