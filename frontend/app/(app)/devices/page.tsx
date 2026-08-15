'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DeviceFormModal } from '@/components/devices/DeviceFormModal';
import { EfficiencyMeter } from '@/components/devices/EfficiencyMeter';
import { IconDevices, IconPlus, IconSearch } from '@/components/layout/Icons';
import { DEVICE_STATUS_META, DEVICE_TYPE_META, DEVICE_TYPES } from '@/lib/constants';
import {
  formatCurrency,
  formatEnergy,
  formatPower,
  formatRelative,
  readingCompletedAt,
} from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { cn } from '@/lib/utils';
import type { Device, Location } from '@/lib/types';

export default function DevicesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { latest } = useLive();

  const devices = useSWR<{ devices: Device[] }>('/api/devices?source=realtime');
  const locations = useSWR<{ locations: Location[] }>('/api/locations');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  const filtered = useMemo(() => {
    const all = devices.data?.devices ?? [];
    const needle = search.trim().toLowerCase();

    return all.filter((device) => {
      if (typeFilter !== 'all' && device.type !== typeFilter) return false;
      if (locationFilter !== 'all' && device.locationId !== locationFilter) return false;
      if (!needle) return true;
      return (
        device.name.toLowerCase().includes(needle) ||
        device.location.name.toLowerCase().includes(needle)
      );
    });
  }, [devices.data, search, typeFilter, locationFilter]);

  /** Current draw for a device, when the live stream has a sample for it. */
  const liveKw = (deviceId: string) =>
    latest?.devices.find((entry) => entry.deviceId === deviceId)?.kw;

  const columns: Column<Device>[] = [
    {
      key: 'name',
      header: 'Device',
      hideOnMobile: true,
      cell: (device) => (
        <div className="flex items-center gap-2.5">
          <span
            className="h-6 w-1 shrink-0 rounded-full"
            style={{
              backgroundColor: DEVICE_TYPE_META[device.type].colorVar,
              boxShadow: `0 0 8px -1px ${DEVICE_TYPE_META[device.type].colorVar}`,
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{device.name}</p>
            <p className="truncate text-2xs text-ink-muted">{device.location.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'lg',
      // The mobile card header already names the type under the device name.
      hideOnMobile: true,
      cell: (device) => (
        <span className="text-xs text-ink-secondary">{DEVICE_TYPE_META[device.type].label}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (device) => {
        const meta = DEVICE_STATUS_META[device.status];
        return (
          <Badge
            tone={meta.tone === 'optimal' ? 'optimal' : meta.tone === 'critical' ? 'critical' : 'neutral'}
            dot
            pulse={device.status === 'ONLINE'}
          >
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: 'now',
      header: 'Now',
      align: 'right',
      hideBelow: 'xl',
      cell: (device) => {
        const kw = liveKw(device.id);
        if (kw === undefined) return <span className="text-xs text-ink-muted">—</span>;
        // Producers stream negative kW. Show the magnitude and mark it as
        // generation, matching how the energy column reads.
        return (
          <span
            className={cn(
              'text-xs font-medium tnum',
              device.isProducer ? 'text-optimal-fg' : 'text-ink',
            )}
          >
            {formatPower(Math.abs(kw))}
          </span>
        );
      },
    },
    {
      key: 'kwh24h',
      header: '24h energy',
      align: 'right',
      cell: (device) => (
        <span className="text-xs font-semibold text-ink tnum">
          {formatEnergy(Math.abs(device.kwh24h), { decimals: 1 })}
          {device.isProducer ? (
            <span className="ml-1 text-2xs font-normal text-optimal-fg">gen</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'cost24h',
      header: '24h cost',
      align: 'right',
      hideBelow: 'lg',
      cell: (device) =>
        device.isProducer ? (
          // Solar has no cost — it offsets one. Showing "-$55.54" in a cost
          // column invites reading it as a charge, so it's labelled as saved.
          <span className="text-xs text-optimal-fg tnum">
            {formatCurrency(Math.abs(device.cost24h), 'USD')}
            <span className="ml-1 text-2xs">saved</span>
          </span>
        ) : (
          <span className="text-xs text-ink-secondary tnum">
            {formatCurrency(device.cost24h, 'USD')}
          </span>
        ),
    },
    {
      key: 'efficiency',
      header: 'Efficiency',
      align: 'right',
      hideBelow: 'md',
      cell: (device) => <EfficiencyMeter score={device.efficiency} />,
    },
    {
      key: 'lastSeen',
      header: 'Last reading',
      align: 'right',
      hideBelow: 'xl',
      cell: (device) => (
        <span className="text-2xs text-ink-muted">
          {device.lastReadingAt
            ? formatRelative(readingCompletedAt(device.lastReadingAt))
            : 'Never'}
        </span>
      ),
    },
  ];

  return (
    <AppShell
      title="Devices"
      description={`${filtered.length} of ${devices.data?.devices.length ?? 0} metered devices`}
      actions={
        isAdmin ? (
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <span className="hidden sm:inline">Add device</span>
          </Button>
        ) : null
      }
    >
      <Card>
        <CardHeader
          title="All devices"
          description="Select a device to see its full history and thresholds"
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                placeholder="Search devices…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                prefix={<IconSearch className="h-3.5 w-3.5" />}
                className="sm:w-48"
                aria-label="Search devices"
              />
              <Select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter by type"
                options={[
                  { value: 'all', label: 'All types' },
                  ...DEVICE_TYPES.map((value) => ({
                    value,
                    label: DEVICE_TYPE_META[value].label,
                  })),
                ]}
                className="sm:w-36"
              />
              <Select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                aria-label="Filter by location"
                options={[
                  { value: 'all', label: 'All locations' },
                  ...(locations.data?.locations ?? []).map((location) => ({
                    value: location.id,
                    label: location.name,
                  })),
                ]}
                className="sm:w-40"
              />
            </div>
          }
        />

        {devices.error ? (
          <ErrorState onRetry={() => devices.mutate()} />
        ) : !devices.data ? (
          <SkeletonTable rows={8} columns={5} />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(device) => device.id}
            onRowClick={(device) => router.push(`/devices/${device.id}`)}
            mobileTitle={(device) => (
              <div className="flex items-center gap-2.5">
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: DEVICE_TYPE_META[device.type].colorVar }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{device.name}</p>
                  <p className="truncate text-2xs text-ink-muted">
                    {device.location.name} · {DEVICE_TYPE_META[device.type].label}
                  </p>
                </div>
              </div>
            )}
            empty={
              <EmptyState
                icon={<IconDevices className="h-5 w-5" />}
                title={
                  devices.data.devices.length === 0
                    ? 'No devices registered'
                    : 'No devices match those filters'
                }
                description={
                  devices.data.devices.length === 0
                    ? 'Add your first metered device to start collecting readings.'
                    : 'Try clearing the search box or widening the type and location filters.'
                }
                action={
                  devices.data.devices.length > 0
                    ? {
                        label: 'Clear filters',
                        onClick: () => {
                          setSearch('');
                          setTypeFilter('all');
                          setLocationFilter('all');
                        },
                      }
                    : undefined
                }
              />
            }
          />
        )}
      </Card>

      <DeviceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        device={editing}
        locations={locations.data?.locations ?? []}
        onSaved={() => devices.mutate()}
      />
    </AppShell>
  );
}
