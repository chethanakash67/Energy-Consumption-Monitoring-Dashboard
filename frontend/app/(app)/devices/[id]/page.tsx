'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton, SkeletonChart } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DeviceSeriesChart } from '@/components/charts/DeviceSeriesChart';
import { EfficiencyMeter } from '@/components/devices/EfficiencyMeter';
import { DeviceFormModal } from '@/components/devices/DeviceFormModal';
import { AlertRow } from '@/components/alerts/AlertRow';
import { IconEdit, IconInbox, IconPulse } from '@/components/layout/Icons';
import {
  DEVICE_STATUS_META,
  DEVICE_TYPE_META,
  RANGE_OPTIONS,
} from '@/lib/constants';
import { useRange } from '@/lib/useRange';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLiveDevice } from '@/lib/live';
import { useToast } from '@/lib/toast';
import {
  formatCurrency,
  formatDate,
  formatEnergy,
  formatPower,
  formatRelative,
  readingCompletedAt,
} from '@/lib/format';
import type {
  AlertsResponse,
  DeviceDetail,
  Location,
  RangeKey,
  SeriesResponse,
} from '@/lib/types';

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const deviceId = params.id;
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { range, query, setPreset } = useRange('7d');

  const device = useSWR<{ device: DeviceDetail }>(`/api/devices/${deviceId}`);
  const series = useSWR<SeriesResponse>(`/api/devices/${deviceId}/series?${query}`);
  const alerts = useSWR<AlertsResponse>(`/api/alerts?deviceId=${deviceId}&limit=8`);
  const locations = useSWR<{ locations: Location[] }>('/api/locations');

  const live = useLiveDevice(deviceId);
  const [editOpen, setEditOpen] = useState(false);

  const detail = device.data?.device;
  const currency = 'USD';

  if (device.error) {
    return (
      <AppShell title="Device">
        <Card>
          <ErrorState
            title="Device not found"
            description="This device may have been removed. Head back to the device list to pick another."
            onRetry={() => router.push('/devices')}
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={detail?.name ?? 'Device'}
      description={
        detail ? `${DEVICE_TYPE_META[detail.type].label} · ${detail.location.name}` : undefined
      }
      actions={
        isAdmin && detail ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<IconEdit className="h-4 w-4" />}
            onClick={() => setEditOpen(true)}
          >
            <span className="hidden sm:inline">Edit</span>
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        <Link
          href="/devices"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-brand"
        >
          ← All devices
        </Link>

        {/* ---- Summary strip ---- */}
        {!detail ? (
          <Card>
            <CardBody>
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div key={index}>
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-6 w-24" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <div className="grid grid-cols-2 gap-x-5 gap-y-5 lg:grid-cols-5">
                <Metric label="Status">
                  <Badge
                    tone={
                      DEVICE_STATUS_META[detail.status].tone === 'optimal'
                        ? 'optimal'
                        : DEVICE_STATUS_META[detail.status].tone === 'critical'
                          ? 'critical'
                          : 'neutral'
                    }
                    dot
                    pulse={detail.status === 'ONLINE'}
                    size="md"
                  >
                    {DEVICE_STATUS_META[detail.status].label}
                  </Badge>
                  <p className="mt-1.5 text-2xs text-ink-muted">
                    {detail.lastReadingAt
                      ? `Last reading ${formatRelative(readingCompletedAt(detail.lastReadingAt))}`
                      : 'No readings yet'}
                  </p>
                </Metric>

                <Metric label="Drawing now">
                  <p className="font-numeric text-xl font-semibold tracking-tight text-ink tabular-nums">
                    {live ? formatPower(Math.abs(live.kw)) : '—'}
                  </p>
                  <p className="mt-1.5 text-2xs text-ink-muted">
                    of {detail.ratedCapacityKw} kW rated
                  </p>
                </Metric>

                <Metric label={detail.isProducer ? 'Generated (24h)' : 'Consumed (24h)'}>
                  <p className="font-numeric text-xl font-semibold tracking-tight text-ink tabular-nums">
                    {formatEnergy(Math.abs(detail.kwh24h), { decimals: 1 })}
                  </p>
                  <p className="mt-1.5 text-2xs text-ink-muted">
                    {formatCurrency(Math.abs(detail.cost24h), currency)} ·{' '}
                    {formatEnergy(Math.abs(detail.peakIntervalKwh))} peak
                  </p>
                </Metric>

                <Metric label="Efficiency">
                  <EfficiencyMeter score={detail.efficiency} className="scale-110 origin-left" />
                  <p className="mt-1.5 text-2xs text-ink-muted">
                    {detail.isProducer
                      ? 'Share of capacity harvested'
                      : 'Headroom below rated capacity'}
                  </p>
                </Metric>

                <Metric label="Open alerts">
                  <p className="font-numeric text-xl font-semibold tracking-tight text-ink tabular-nums">
                    {detail.openAlerts}
                  </p>
                  <p className="mt-1.5 text-2xs text-ink-muted">
                    Installed {formatDate(detail.installedAt)}
                  </p>
                </Metric>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ---- Series ---- */}
        <Card>
          <CardHeader
            title="Consumption history"
            description={
              series.data ? `${series.data.points.length} buckets in range` : undefined
            }
            action={
              <SegmentedControl
                aria-label="Time range"
                value={range.key}
                onChange={(value) => setPreset(value as RangeKey)}
                options={RANGE_OPTIONS.map(({ value, label, description }) => ({
                  value,
                  label,
                  title: description,
                }))}
              />
            }
          />
          <CardBody>
            {series.error ? (
              <ErrorState onRetry={() => series.mutate()} compact />
            ) : !series.data || !detail ? (
              <>
                <Skeleton className="mb-3 h-3 w-44" />
                <SkeletonChart height={320} />
              </>
            ) : series.data.points.length === 0 ? (
              <EmptyState
                icon={<IconPulse className="h-5 w-5" />}
                title="No readings in this range"
                description="This device hasn't reported during the selected window. Try a wider range."
              />
            ) : (
              <DeviceSeriesChart
                points={series.data.points}
                granularity={series.data.granularity}
                currency={currency}
                threshold={detail.thresholdKwh}
                isProducer={detail.isProducer}
              />
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* ---- Threshold config ---- */}
          <ThresholdCard
            device={detail}
            canEdit={isAdmin}
            onSaved={() => {
              device.mutate();
              toast({
                title: 'Threshold updated',
                tone: 'success',
                duration: 3000,
              });
            }}
          />

          {/* ---- Device alerts ---- */}
          <Card className="lg:col-span-2">
            <CardHeader title="Alert history" description="Most recent events for this device" />
            {alerts.error ? (
              <ErrorState onRetry={() => alerts.mutate()} compact />
            ) : !alerts.data ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.data.alerts.length === 0 ? (
              <EmptyState
                icon={<IconInbox className="h-5 w-5" />}
                title="No alerts recorded"
                description="This device has stayed within its expected envelope for the whole retention window."
                compact
              />
            ) : (
              <div className="divide-y divide-line">
                {alerts.data.alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} compact />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {detail ? (
        <DeviceFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          device={detail}
          locations={locations.data?.locations ?? []}
          onSaved={() => {
            device.mutate();
            series.mutate();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Inline threshold editor — the main per-device configuration surface. */
function ThresholdCard({
  device,
  canEdit,
  onSaved,
}: {
  device?: DeviceDetail;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(device?.thresholdKwh != null ? String(device.thresholdKwh) : '');
  }, [device?.thresholdKwh]);

  async function save() {
    if (!device) return;
    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/api/devices/${device.id}`, {
        method: 'PATCH',
        body: { thresholdKwh: value.trim() === '' ? null : Number(value) },
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const dirty = device
    ? value.trim() !== (device.thresholdKwh != null ? String(device.thresholdKwh) : '')
    : false;

  return (
    <Card>
      <CardHeader title="Alert threshold" description="Per-interval consumption limit" />
      <CardBody className="space-y-4">
        {!device ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <Input
              label="Notify above"
              type="number"
              min="0"
              step="0.1"
              suffix="kWh"
              placeholder="No threshold set"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={!canEdit || saving}
              error={error ?? undefined}
              hint={
                canEdit
                  ? 'Applies to each 15-minute interval. Leave blank to disable.'
                  : 'Only administrators can change thresholds.'
              }
            />

            {device.thresholdKwh ? (
              <div className="rounded-md bg-surface-subtle px-3 py-2.5">
                <p className="text-2xs text-ink-muted">
                  Current peak interval is{' '}
                  <span className="font-medium text-ink-secondary tnum">
                    {formatEnergy(Math.abs(device.peakIntervalKwh))}
                  </span>
                  , averaging{' '}
                  <span className="font-medium text-ink-secondary tnum">
                    {formatEnergy(Math.abs(device.avgIntervalKwh))}
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={save}
                loading={saving}
                disabled={!dirty}
                className="w-full"
              >
                {dirty ? 'Save threshold' : 'Saved'}
              </Button>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
