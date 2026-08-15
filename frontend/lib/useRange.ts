'use client';

import { useCallback, useMemo, useState } from 'react';
import { buildQuery } from './api';
import type { RangeKey } from './types';

export interface RangeState {
  key: RangeKey;
  /** Only set when `key === 'custom'`. ISO strings. */
  from?: string;
  to?: string;
}

const PRESET_HOURS: Record<Exclude<RangeKey, 'custom'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

/**
 * Shared time-range state.
 *
 * Returns the query string every analytics request needs, plus the resolved
 * absolute window so labels ("vs previous 7 days") stay in sync with whatever
 * the API actually queried.
 */
export function useRange(initial: RangeKey = '7d') {
  const [range, setRange] = useState<RangeState>({ key: initial });

  const { from, to } = useMemo(() => {
    if (range.key === 'custom' && range.from && range.to) {
      return { from: new Date(range.from), to: new Date(range.to) };
    }
    const hours = PRESET_HOURS[(range.key as Exclude<RangeKey, 'custom'>) ?? '7d'] ?? 168;
    const end = new Date();
    return { from: new Date(end.getTime() - hours * 3_600_000), to: end };
  }, [range]);

  /** Query params for the analytics endpoints, timezone included. */
  const query = useMemo(() => {
    if (range.key === 'custom' && range.from && range.to) {
      return buildQuery({ from: range.from, to: range.to });
    }
    return buildQuery({ range: range.key });
  }, [range]);

  const setPreset = useCallback((key: RangeKey) => setRange({ key }), []);

  const setCustom = useCallback((fromIso: string, toIso: string) => {
    setRange({ key: 'custom', from: fromIso, to: toIso });
  }, []);

  /** Human label for the comparison period, e.g. "vs previous 7 days". */
  const comparisonLabel = useMemo(() => {
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (days <= 1) return 'vs previous 24 hours';
    return `vs previous ${days} days`;
  }, [from, to]);

  return { range, query, from, to, setPreset, setCustom, comparisonLabel };
}
