'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { AppSettings } from '@/lib/types';

/**
 * Global tariff and carbon-intensity configuration.
 *
 * Changing these re-prices every chart in the product, so the card says so
 * explicitly — an admin should not have to discover that by watching the
 * dashboard shift under them.
 */
export function TariffSettings() {
  const settings = useSWR<{ settings: AppSettings }>('/api/settings');
  const { toast } = useToast();

  const [tariff, setTariff] = useState('');
  const [carbon, setCarbon] = useState('');
  const [currency, setCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setTariff(String(settings.data.settings.tariffPerKwh));
    setCarbon(String(settings.data.settings.carbonKgPerKwh));
    setCurrency(settings.data.settings.currency);
  }, [settings.data]);

  const dirty =
    settings.data &&
    (tariff !== String(settings.data.settings.tariffPerKwh) ||
      carbon !== String(settings.data.settings.carbonKgPerKwh) ||
      currency !== settings.data.settings.currency);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: {
          tariffPerKwh: Number(tariff),
          carbonKgPerKwh: Number(carbon),
          currency: currency.toUpperCase(),
        },
      });
      await settings.mutate();
      toast({
        title: 'Tariff updated',
        description: 'New readings will be priced at this rate.',
        tone: 'success',
        duration: 4000,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (settings.error) {
    return (
      <Card>
        <CardHeader title="Tariff & emissions" />
        <ErrorState onRetry={() => settings.mutate()} compact />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Tariff & emissions"
        description="Used to price every reading and estimate carbon output"
      />
      <CardBody className="space-y-4">
        {!settings.data ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Base rate"
                type="number"
                min="0"
                step="0.001"
                prefix={<span className="text-xs">$</span>}
                suffix="/ kWh"
                value={tariff}
                onChange={(event) => setTariff(event.target.value)}
                hint="Before time-of-use multipliers."
              />
              <Input
                label="Currency"
                maxLength={3}
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                hint="Three-letter ISO code, e.g. USD."
              />
            </div>

            <Input
              label="Grid carbon intensity"
              type="number"
              min="0"
              step="0.001"
              suffix="kg CO₂e / kWh"
              value={carbon}
              onChange={(event) => setCarbon(event.target.value)}
              hint="Regional average. 0.417 approximates the US grid mix."
            />

            <div className="rounded-md bg-surface-subtle px-3 py-2.5">
              <p className="text-2xs leading-relaxed text-ink-muted">
                Peak hours (4–8pm) are billed at 1.55x this rate and overnight hours at 0.72x.
                Changing the base rate affects readings recorded from now on; historical costs
                keep the rate they were priced at.
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5">
                <p className="text-xs text-critical-fg">{error}</p>
              </div>
            ) : null}
          </>
        )}
      </CardBody>

      {settings.data ? (
        <CardFooter className="flex justify-end">
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
