'use client';

import { useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

type AlertStatus = 'active' | 'resolved' | 'dismissed';

type Alert = {
  alert_id: number;
  device_id: string;
  timestamp: string;
  alert_type: string;
  expected_wattage_range: string;
  actual_wattage: number;
  message: string;
  status: AlertStatus;
};

type RangeKey = 'today' | 'week' | 'month' | 'all';

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangeStart(range: RangeKey): number | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') return startOfDay(now).getTime();
  if (range === 'week') return startOfDay(now).getTime() - 6 * 86400_000;
  return startOfDay(now).getTime() - 29 * 86400_000;
}

type BucketKey = 'today' | 'yesterday' | 'earlierWeek' | 'earlierMonth' | 'older';
const BUCKET_LABEL: Record<BucketKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlierWeek: 'Earlier this week',
  earlierMonth: 'Earlier this month',
  older: 'Older',
};
const BUCKET_ORDER: BucketKey[] = ['today', 'yesterday', 'earlierWeek', 'earlierMonth', 'older'];

function bucketFor(timestamp: string): BucketKey {
  const now = new Date();
  const todayMs = startOfDay(now).getTime();
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return 'older';
  if (t >= todayMs) return 'today';
  if (t >= todayMs - 86400_000) return 'yesterday';
  if (t >= todayMs - 6 * 86400_000) return 'earlierWeek';
  if (t >= todayMs - 29 * 86400_000) return 'earlierMonth';
  return 'older';
}

function formatTimeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFullStamp(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AlertCard({
  alert,
  isOpen,
  onToggle,
  onMarkResolved,
  onDismiss,
  mutating,
}: {
  alert: Alert;
  isOpen: boolean;
  onToggle: () => void;
  onMarkResolved: () => void;
  onDismiss: () => void;
  mutating: boolean;
}) {
  const { t } = useLang();
  const isResolved = alert.status === 'resolved';
  const isDismissed = alert.status === 'dismissed';
  const isActive = alert.status === 'active';

  const statusBadge = isResolved
    ? { dot: 'bg-success-soft text-success', glyph: '✓' }
    : isDismissed
      ? { dot: 'bg-elevated text-ink-3', glyph: '×' }
      : { dot: 'bg-signal-soft text-signal-strong', glyph: '!' };

  const statusLabel = isResolved
    ? t('common.resolved')
    : isDismissed
      ? 'Dismissed'
      : t('common.active');

  return (
    <li
      className={`border rounded-lg overflow-hidden ${
        isActive ? 'border-signal-soft bg-surface' : 'border-line bg-surface'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-elevated transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${statusBadge.dot}`}
            aria-hidden
          >
            {statusBadge.glyph}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs uppercase tracking-wider font-semibold text-ink-3">
                {statusLabel}
              </span>
              <span className="text-sm font-medium text-ink truncate">
                {alert.device_id}
              </span>
              <span className="text-xs text-ink-3 tabular">
                {formatTimeOfDay(alert.timestamp)}
              </span>
            </div>
            <p className="text-sm text-ink-2 mt-1 leading-snug truncate">
              {alert.message}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-wider text-ink-3">Actual</p>
            <p className="font-readout text-lg text-signal-strong leading-none mt-0.5">
              {Math.round(alert.actual_wattage)}
              <span className="text-xs font-sans text-ink-3 font-normal ml-1">W</span>
            </p>
          </div>
          <span
            className={`text-ink-3 text-base transition-transform shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            ⌄
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-line px-5 py-4 bg-page">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mb-4">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">When</dt>
              <dd className="text-sm text-ink tabular">{formatFullStamp(alert.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">Meter</dt>
              <dd className="text-sm text-ink tabular truncate">{alert.device_id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">
                {t('common.expectedRange')}
              </dt>
              <dd className="text-sm text-ink tabular">{alert.expected_wattage_range} W</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">Type</dt>
              <dd className="text-sm text-ink">
                {t(`reports.type.${alert.alert_type}`) !== `reports.type.${alert.alert_type}`
                  ? t(`reports.type.${alert.alert_type}`)
                  : alert.alert_type.replace(/_/g, ' ').toLowerCase()}
              </dd>
            </div>
          </dl>
          <p className="text-xs uppercase tracking-wider text-accent font-semibold mb-2">
            {t('reports.recommendation')}
          </p>
          <p className="text-sm text-ink leading-relaxed max-w-2xl">{alert.message}</p>
          {isActive && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onMarkResolved();
                }}
                disabled={mutating}
                className="px-4 py-2 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:bg-ink-2 transition-colors disabled:opacity-50"
              >
                {t('common.markResolved')}
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onDismiss();
                }}
                disabled={mutating}
                className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors disabled:opacity-50"
              >
                {t('common.dismiss')}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function GroupedAlerts({
  alerts,
  openId,
  setOpenId,
  onMarkResolved,
  onDismiss,
  mutating,
}: {
  alerts: Alert[];
  openId: number | null;
  setOpenId: (id: number | null) => void;
  onMarkResolved: (id: number) => void;
  onDismiss: (id: number) => void;
  mutating: boolean;
}) {
  // Bucket the alerts and preserve descending time within each bucket.
  const grouped = useMemo(() => {
    const out: Record<BucketKey, Alert[]> = {
      today: [],
      yesterday: [],
      earlierWeek: [],
      earlierMonth: [],
      older: [],
    };
    for (const a of alerts) {
      out[bucketFor(a.timestamp)].push(a);
    }
    return out;
  }, [alerts]);

  return (
    <div className="space-y-8">
      {BUCKET_ORDER.map(bucket => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <div key={bucket}>
            <div className="flex items-baseline gap-3 mb-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-ink-2">
                {BUCKET_LABEL[bucket]}
              </h3>
              <span className="text-xs text-ink-3 tabular">{items.length}</span>
            </div>
            <ul className="space-y-2">
              {items.map(a => (
                <AlertCard
                  key={a.alert_id}
                  alert={a}
                  isOpen={openId === a.alert_id}
                  onToggle={() => setOpenId(openId === a.alert_id ? null : a.alert_id)}
                  onMarkResolved={() => onMarkResolved(a.alert_id)}
                  onDismiss={() => onDismiss(a.alert_id)}
                  mutating={mutating}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsContent() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const { t } = useLang();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, isError } = useQuery<Alert[]>({
    queryKey: ['alerts-all'],
    queryFn: async () => {
      const response = await api.get<Alert[]>('/analytics/');
      return response.data;
    },
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: number; status: AlertStatus }) => {
      await api.patch(`/analytics/${alertId}/`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-all'] });
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
    },
  });

  // Drop everything outside the selected range; sort newest first so the
  // bucket order (Today → Older) lines up with intuition.
  const filtered = useMemo(() => {
    const cutoff = rangeStart(rangeKey);
    return alerts
      .filter(a => {
        if (cutoff === null) return true;
        const t = new Date(a.timestamp).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, rangeKey]);

  const active = filtered.filter(a => a.status === 'active');
  const past = filtered.filter(a => a.status !== 'active');

  const handleMarkResolved = (id: number) =>
    updateMutation.mutate({ alertId: id, status: 'resolved' });
  const handleDismiss = (id: number) =>
    updateMutation.mutate({ alertId: id, status: 'dismissed' });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-ink tracking-tight">{t('reports.title')}</h1>
        <p className="text-sm text-ink-2 mt-2 max-w-xl leading-relaxed">{t('reports.lede')}</p>
      </div>

      <div
        role="tablist"
        aria-label="Time range"
        className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-1 text-xs mb-10"
      >
        {RANGE_OPTIONS.map(opt => {
          const active = rangeKey === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRangeKey(opt.key)}
              className={`px-3 py-1.5 rounded transition-colors ${
                active
                  ? 'text-ink font-medium bg-elevated'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <p className="text-ink-2">Loading...</p>
        </div>
      ) : isError ? (
        <div className="flex justify-center items-center h-32">
          <p className="text-signal-strong">Error loading anomalies.</p>
        </div>
      ) : (
        <>
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display text-2xl text-ink tracking-tight">
                {t('reports.activeHeading')}
              </h2>
              <span className="text-xs text-ink-3 font-medium tabular">{active.length}</span>
            </div>
            {active.length === 0 ? (
              <div className="border border-line rounded-lg bg-surface px-6 py-8">
                <p className="font-display text-lg text-success">{t('reports.allClear.title')}</p>
                <p className="text-sm text-ink-2 mt-1 max-w-xl">{t('reports.allClear.body')}</p>
              </div>
            ) : (
              <GroupedAlerts
                alerts={active}
                openId={openId}
                setOpenId={setOpenId}
                onMarkResolved={handleMarkResolved}
                onDismiss={handleDismiss}
                mutating={updateMutation.isPending}
              />
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display text-2xl text-ink tracking-tight">
                {t('reports.historyHeading')}
              </h2>
              <span className="text-xs text-ink-3 font-medium tabular">{past.length}</span>
            </div>
            {past.length === 0 ? (
              <div className="border border-line rounded-lg bg-surface px-6 py-8">
                <p className="text-sm font-medium text-ink">{t('reports.noHistory.title')}</p>
                <p className="text-sm text-ink-2 mt-1">{t('reports.noHistory.body')}</p>
              </div>
            ) : (
              <GroupedAlerts
                alerts={past}
                openId={openId}
                setOpenId={setOpenId}
                onMarkResolved={handleMarkResolved}
                onDismiss={handleDismiss}
                mutating={updateMutation.isPending}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
