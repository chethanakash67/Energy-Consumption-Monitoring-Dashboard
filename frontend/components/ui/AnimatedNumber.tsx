'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** Renders the interpolated value — keeps unit/currency logic at the call site. */
  format: (value: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Counts from the previous value to the next one.
 *
 * Uses rAF with an ease-out curve rather than a CSS transition because the
 * *text* has to change, not just a style. Respects `prefers-reduced-motion` by
 * snapping straight to the final value.
 */
export function AnimatedNumber({
  value,
  format,
  durationMs = 900,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (from === to) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutExpo — fast start, long settle, which reads as "landing".
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = from + (to - from) * eased;

      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Bank the interrupted position so a re-render mid-flight doesn't jump.
      fromRef.current = display;
    };
    // `display` is intentionally excluded — including it would restart the
    // animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
