'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { AlertRow } from '@/components/alerts/AlertRow';
import { IconCheck, IconInbox } from '@/components/layout/Icons';
import { useAlertActions } from '@/lib/useAlertActions';
import { ALERT_TYPE_META, SEVERITY_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { AlertsResponse, AlertType, Severity } from '@/lib/types';

type StatusFilter = 'open' | 'acknowledged' | 'all';

export default function AlertsPage() {
  const [status, setStatus] = useState<StatusFilter>('open');
  const [severity, setSeverity] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const { acknowledge, acknowledgeAll, acknowledging } = useAlertActions();

  const query = new URLSearchParams({ source: 'realtime', status, limit: '100' });
  if (severity !== 'all') query.set('severity', severity);
  if (type !== 'all') query.set('type', type);

  const alerts = useSWR<AlertsResponse>(`/api/alerts?${query.toString()}`);
  const counts = alerts.data?.openCounts;

  async function handleAcknowledgeAll() {
    setBulkRunning(true);
    try {
      await acknowledgeAll('realtime');
      setConfirmOpen(false);
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <AppShell
      title="Alerts"
      description="Anomalies, threshold breaches, and efficiency warnings"
      actions={
        counts && counts.total > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<IconCheck className="h-4 w-4" />}
            onClick={() => setConfirmOpen(true)}
          >
            <span className="hidden sm:inline">Acknowledge all</span>
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {/* ---- Severity summary ---- */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CountTile
            label="Open alerts"
            value={counts?.total}
            tone="neutral"
            loading={!alerts.data}
          />
          <CountTile
            label="Critical"
            value={counts?.critical}
            tone="critical"
            loading={!alerts.data}
          />
          <CountTile
            label="Warning"
            value={counts?.warning}
            tone="high"
            loading={!alerts.data}
          />
          <CountTile label="Info" value={counts?.info} tone="elevated" loading={!alerts.data} />
        </div>

        <Card>
          <CardHeader
            title="Alert log"
            description={
              alerts.data ? `${alerts.data.alerts.length} shown` : 'Loading events…'
            }
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <SegmentedControl
                  aria-label="Alert status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'acknowledged', label: 'Acknowledged' },
                    { value: 'all', label: 'All' },
                  ]}
                />
                <Select
                  aria-label="Filter by severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  options={[
                    { value: 'all', label: 'All severities' },
                    ...(Object.keys(SEVERITY_META) as Severity[]).map((value) => ({
                      value,
                      label: SEVERITY_META[value].label,
                    })),
                  ]}
                  className="sm:w-40"
                />
                <Select
                  aria-label="Filter by type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  options={[
                    { value: 'all', label: 'All types' },
                    ...(Object.keys(ALERT_TYPE_META) as AlertType[]).map((value) => ({
                      value,
                      label: ALERT_TYPE_META[value].label,
                    })),
                  ]}
                  className="sm:w-40"
                />
              </div>
            }
          />

          {alerts.error ? (
            <ErrorState onRetry={() => alerts.mutate()} />
          ) : !alerts.data ? (
            <div className="divide-y divide-line">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.data.alerts.length === 0 ? (
            <EmptyState
              icon={<IconInbox className="h-5 w-5" />}
              title={
                status === 'open'
                  ? 'No open alerts'
                  : status === 'acknowledged'
                    ? 'Nothing acknowledged yet'
                    : 'No alerts match those filters'
              }
              description={
                status === 'open'
                  ? 'Every device is running within its expected envelope. New anomalies appear here the moment they are detected.'
                  : 'Try switching the status tab or widening the severity and type filters.'
              }
              action={
                severity !== 'all' || type !== 'all'
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSeverity('all');
                        setType('all');
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {alerts.data.alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={acknowledge}
                  acknowledging={acknowledging === alert.id}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Acknowledge all open alerts?"
        description={`This marks all ${counts?.total ?? 0} open alerts as reviewed and attributes them to you. It cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={bulkRunning}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAcknowledgeAll} loading={bulkRunning}>
              Acknowledge all
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          Alerts stay in the log and remain searchable under the “Acknowledged” tab — this only
          clears them from the open queue.
        </p>
      </Modal>
    </AppShell>
  );
}

function CountTile({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value?: number;
  tone: 'neutral' | 'critical' | 'high' | 'elevated';
  loading: boolean;
}) {
  return (
    <div className="glass glass-edge rounded-lg p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            tone === 'neutral' && 'bg-ink-muted',
            tone === 'critical' && 'bg-critical shadow-[0_0_6px_1px_var(--glow-critical)]',
            tone === 'high' && 'bg-high shadow-[0_0_6px_1px_var(--glow-high)]',
            tone === 'elevated' && 'bg-elevated shadow-[0_0_6px_1px_var(--glow-elevated)]',
          )}
        />
        <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      </div>
      {loading ? (
        <Skeleton className="mt-2.5 h-7 w-12" />
      ) : (
        <p className="mt-2 font-numeric text-2xl font-semibold tracking-tight text-ink tabular-nums">
          {value ?? 0}
        </p>
      )}
    </div>
  );
}
