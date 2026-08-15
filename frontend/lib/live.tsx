'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSWRConfig } from 'swr';
import { API_BASE, apiFetch, getToken } from './api';
import { useAuth } from './auth';
import { useToast } from './toast';
import { SEVERITY_META } from './constants';
import type { Alert, LivePayload, RealtimeStatus, Severity } from './types';

export type ConnectionState = 'connecting' | 'live' | 'offline';

interface LiveContextValue {
  status: ConnectionState;
  /** Most recent instantaneous snapshot, or null before the first event. */
  latest: LivePayload | null;
  /** Rolling window of recent snapshots for the live sparkline. */
  history: LivePayload[];
  /** Alerts received during this session, newest first. */
  liveAlerts: Alert[];
  /** Backend realtime ingest status, including the latest external API snapshot. */
  realtimeStatus: RealtimeStatus | null;
  refreshRealtimeStatus: () => Promise<void>;
}

const LiveContext = createContext<LiveContextValue>({
  status: 'connecting',
  latest: null,
  history: [],
  liveAlerts: [],
  realtimeStatus: null,
  refreshRealtimeStatus: async () => {},
});

/** Number of live samples retained for the sparkline (~2.5 min at 4s ticks). */
const HISTORY_SIZE = 40;

const TOAST_TONE: Record<Severity, 'elevated' | 'critical'> = {
  INFO: 'elevated',
  WARNING: 'elevated',
  CRITICAL: 'critical',
};

/**
 * Subscribes to the backend's SSE stream and fans events out to the app.
 *
 * Mounted once inside the authenticated layout — a single connection serves
 * every page, so navigating between routes never re-opens the stream.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { mutate } = useSWRConfig();

  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [latest, setLatest] = useState<LivePayload | null>(null);
  const [history, setHistory] = useState<LivePayload[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null);

  // Held in a ref so the SSE handler always reads current prefs without
  // needing to tear down and re-open the connection when they change.
  const prefs = useRef({ notifyInApp: true, minLevel: 'WARNING' as Severity });
  prefs.current = {
    notifyInApp: user?.notifyInApp ?? true,
    minLevel: user?.notifyMinLevel ?? 'WARNING',
  };

  const handleAlert = useCallback(
    (alert: Alert) => {
      setLiveAlerts((current) => [alert, ...current].slice(0, 20));

      // Any alert should refresh the alert lists and open-count badges.
      mutate((key) => typeof key === 'string' && key.startsWith('/api/alerts'));

      const { notifyInApp, minLevel } = prefs.current;
      if (!notifyInApp) return;
      if (SEVERITY_META[alert.severity].rank < SEVERITY_META[minLevel].rank) return;

      toast({
        title: `${SEVERITY_META[alert.severity].label}: ${alert.device.name}`,
        description: alert.message,
        tone: TOAST_TONE[alert.severity],
        duration: alert.severity === 'CRITICAL' ? 0 : 8000,
        action: {
          label: 'View alerts',
          onClick: () => {
            window.location.href = '/alerts';
          },
        },
      });
    },
    [mutate, toast],
  );

  const refreshRealtimeStatus = useCallback(async () => {
    try {
      const nextStatus = await apiFetch<RealtimeStatus>('/api/realtime/status');
      setRealtimeStatus(nextStatus);

      if (nextStatus.latest) {
        const payload: LivePayload = {
          timestamp: nextStatus.latest.timestamp,
          totalKw: nextStatus.latest.netKw,
          demandKw: nextStatus.latest.demandKw,
          generationKw: nextStatus.latest.generationKw,
          costPerHour: nextStatus.latest.costPerHour,
          devices: [],
        };
        setLatest((current) => current ?? payload);
        setHistory((current) => (current.length ? current : [payload]));
      }
    } catch {
      setRealtimeStatus((current) =>
        current
          ? { ...current, lastError: current.lastError ?? 'Realtime status unavailable' }
          : null,
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      setStatus((current) => (current === 'live' ? current : 'connecting'));

      source = new EventSource(
        `${API_BASE}/api/stream?token=${encodeURIComponent(token)}`,
      );

      source.addEventListener('live', (event) => {
        attempt = 0;
        setStatus('live');
        const payload = JSON.parse((event as MessageEvent).data) as LivePayload;
        setLatest(payload);
        setHistory((current) => [...current, payload].slice(-HISTORY_SIZE));
      });

      source.addEventListener('alert', (event) => {
        handleAlert(JSON.parse((event as MessageEvent).data) as Alert);
      });

      // A new stored interval means every chart's underlying data changed.
      source.addEventListener('reading', () => {
        mutate(
          (key) =>
            typeof key === 'string' &&
            (key.startsWith('/api/analytics') ||
              key.startsWith('/api/devices') ||
              key.startsWith('/api/realtime')),
        );
        refreshRealtimeStatus();
      });

      source.onerror = () => {
        source?.close();
        if (closed) return;
        setStatus('offline');

        // Exponential backoff, capped — a backend restart shouldn't turn into
        // a reconnect storm.
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    refreshRealtimeStatus();
    connect();

    return () => {
      closed = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [user, handleAlert, mutate, refreshRealtimeStatus]);

  const value = useMemo(
    () => ({ status, latest, history, liveAlerts, realtimeStatus, refreshRealtimeStatus }),
    [status, latest, history, liveAlerts, realtimeStatus, refreshRealtimeStatus],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}

/** Live draw for one device, or null when it isn't in the latest snapshot. */
export function useLiveDevice(deviceId: string | undefined) {
  const { latest } = useLive();
  if (!deviceId || !latest) return null;
  return latest.devices.find((device) => device.deviceId === deviceId) ?? null;
}
