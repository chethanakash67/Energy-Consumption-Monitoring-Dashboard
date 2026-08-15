'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { apiFetch } from './api';
import { useToast } from './toast';

/**
 * Acknowledge actions shared by the dashboard feed and the alerts page.
 *
 * Acknowledging changes the open-alert count in several places at once — the
 * sidebar badge, the dashboard KPI, the alerts page tiles — each of which is
 * its own SWR key. Revalidating only the caller's key leaves the others stale,
 * so this invalidates every alert and summary query instead.
 */
export function useAlertActions() {
  const { mutate } = useSWRConfig();
  const { toast } = useToast();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const revalidate = useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === 'string' &&
          (key.startsWith('/api/alerts') || key.startsWith('/api/analytics/summary')),
      ),
    [mutate],
  );

  const acknowledge = useCallback(
    async (id: string) => {
      setAcknowledging(id);
      try {
        await apiFetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
        await revalidate();
        toast({ title: 'Alert acknowledged', tone: 'success', duration: 2500 });
      } catch {
        toast({
          title: "Couldn't acknowledge alert",
          description: 'The request failed. Please try again.',
          tone: 'critical',
        });
      } finally {
        setAcknowledging(null);
      }
    },
    [revalidate, toast],
  );

  const acknowledgeAll = useCallback(async (source?: 'realtime') => {
    const suffix = source ? `?source=${source}` : '';
    const result = await apiFetch<{ acknowledged: number }>(`/api/alerts/acknowledge-all${suffix}`, {
      method: 'POST',
    });
    await revalidate();
    toast({
      title: `${result.acknowledged} alerts acknowledged`,
      description: 'The open queue is clear.',
      tone: 'success',
      duration: 4000,
    });
    return result.acknowledged;
  }, [revalidate, toast]);

  return { acknowledge, acknowledgeAll, acknowledging };
}
