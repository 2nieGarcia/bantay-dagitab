'use client';

import { useState } from 'react';
import { useLang } from '@/lib/i18n';

type Alert = {
  alert_id: string;
  device_id: string;
  timestamp: string;
  alert_type: 'HIGH_USAGE_ANOMALY' | 'UNUSUAL_PATTERN' | 'DEVICE_MALFUNCTION' | 'BILLING_DISCREPANCY';
  expected_wattage_range: string;
  actual_wattage: number;
  messageKey: string;
  recommendationKey: string;
  resolved_at?: string;
};

const active: Alert[] = [
  {
    alert_id: 'alert_001',
    device_id: 'meter_manila_001',
    timestamp: '2026-05-17T14:30:00Z',
    alert_type: 'HIGH_USAGE_ANOMALY',
    expected_wattage_range: '100–250',
    actual_wattage: 450.5,
    messageKey: 'reports.alert1.message',
    recommendationKey: 'reports.alert1.recommendation',
  },
  {
    alert_id: 'alert_002',
    device_id: 'meter_manila_002',
    timestamp: '2026-05-17T12:15:00Z',
    alert_type: 'UNUSUAL_PATTERN',
    expected_wattage_range: '50–150',
    actual_wattage: 280,
    messageKey: 'reports.alert2.message',
    recommendationKey: 'reports.alert2.recommendation',
  },
  {
    alert_id: 'alert_003',
    device_id: 'meter_manila_001',
    timestamp: '2026-05-17T08:45:00Z',
    alert_type: 'DEVICE_MALFUNCTION',
    expected_wattage_range: '0–50',
    actual_wattage: 200,
    messageKey: 'reports.alert3.message',
    recommendationKey: 'reports.alert3.recommendation',
  },
];

const past: Alert[] = [
  {
    alert_id: 'alert_past_001',
    device_id: 'meter_manila_001',
    timestamp: '2026-05-16T18:00:00Z',
    alert_type: 'HIGH_USAGE_ANOMALY',
    expected_wattage_range: '100–250',
    actual_wattage: 420,
    messageKey: 'reports.past1.message',
    recommendationKey: 'reports.past1.recommendation',
    resolved_at: '2026-05-16T20:30:00Z',
  },
  {
    alert_id: 'alert_past_002',
    device_id: 'meter_manila_002',
    timestamp: '2026-05-15T10:00:00Z',
    alert_type: 'BILLING_DISCREPANCY',
    expected_wattage_range: '50–150',
    actual_wattage: 180,
    messageKey: 'reports.past2.message',
    recommendationKey: 'reports.past2.recommendation',
    resolved_at: '2026-05-15T14:00:00Z',
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AlertCard({
  alert,
  isResolved,
  isOpen,
  onToggle,
}: {
  alert: Alert;
  isResolved: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useLang();
  return (
    <li className={`border rounded-lg overflow-hidden ${isResolved ? 'border-line bg-surface' : 'border-signal-soft bg-surface'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-6 py-5 hover:bg-elevated transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-start gap-4">
          <span
            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              isResolved ? 'bg-success-soft text-success' : 'bg-signal-soft text-signal-strong'
            }`}
            aria-hidden
          >
            {isResolved ? '✓' : '!'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-3 mb-1">
              <h3 className="font-display text-lg text-ink">
                {t(`reports.type.${alert.alert_type}`)}
              </h3>
              <span className="text-xs text-ink-3 font-medium uppercase tracking-wider">
                {isResolved ? t('common.resolved') : t('common.active')}
              </span>
              <span className="text-xs text-ink-3 tabular">{formatDate(alert.timestamp)}</span>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">{t(alert.messageKey)}</p>
          </div>
          <span className={`text-ink-3 text-base transition-transform shrink-0 mt-1 ${isOpen ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-5 pl-11">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">Meter</dt>
            <dd className="text-sm text-ink tabular truncate">{alert.device_id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">{t('common.expectedRange')}</dt>
            <dd className="text-sm text-ink tabular">{alert.expected_wattage_range} W</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">{t('common.actualReading')}</dt>
            <dd className="font-readout text-lg text-signal-strong leading-none">
              {alert.actual_wattage} <span className="text-xs font-sans text-ink-3 font-normal">W</span>
            </dd>
          </div>
          {isResolved && alert.resolved_at && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-3 mb-0.5">{t('common.resolved')}</dt>
              <dd className="text-sm text-ink tabular">{formatDate(alert.resolved_at)}</dd>
            </div>
          )}
        </dl>
      </button>

      {isOpen && (
        <div className="border-t border-line px-6 py-5 bg-page">
          <p className="text-xs uppercase tracking-wider text-accent font-semibold mb-2">
            {t('reports.recommendation')}
          </p>
          <p className="text-sm text-ink leading-relaxed max-w-2xl">{t(alert.recommendationKey)}</p>
          {!isResolved && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button className="px-4 py-2 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:bg-ink-2 transition-colors">
                {t('common.markResolved')}
              </button>
              <button className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
                {t('common.dismiss')}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function ReportsContent() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-12">
        <h1 className="font-display text-4xl text-ink tracking-tight">{t('reports.title')}</h1>
        <p className="text-sm text-ink-2 mt-2 max-w-xl leading-relaxed">{t('reports.lede')}</p>
      </div>

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
          <ul className="space-y-3">
            {active.map(a => (
              <AlertCard
                key={a.alert_id}
                alert={a}
                isResolved={false}
                isOpen={openId === a.alert_id}
                onToggle={() => setOpenId(openId === a.alert_id ? null : a.alert_id)}
              />
            ))}
          </ul>
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
          <ul className="space-y-3">
            {past.map(a => (
              <AlertCard
                key={a.alert_id}
                alert={a}
                isResolved
                isOpen={openId === a.alert_id}
                onToggle={() => setOpenId(openId === a.alert_id ? null : a.alert_id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
