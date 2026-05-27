'use client';

import { useState } from 'react';
import ComputerIcon from '@mui/icons-material/Computer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerIcon from '@mui/icons-material/Power';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import KitchenIcon from '@mui/icons-material/Kitchen';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DashboardCardTemplate } from '@/components/templates/DashboardCardTemplate';
import { EmptyState } from '@/components/templates/EmptyState';

// API Response Types
type AnomalyApi = {
  alert_id: string;
  user_id: number;
  device_id: string;
  timestamp: string;
  alert_type: string;
  expected_wattage_range: string;
  actual_wattage: number;
  message: string;
};

type BillVsTelemetryApi = {
  bill_id: number;
  user_id: number;
  meralco_account_number: string;
  billing_period: string;
  billed_kwh: number;
  total_bill_php: number;
  telemetry_kwh: number;
  kwh_variance: number;
};

type MonthlyConsumptionApi = {
  user_id: number;
  month: string;
  kwh: number;
};

type LatestReadingApi = {
  id: number;
  device_id: string;
  user_account_id: number;
  timestamp: string;
  avg_wattage: number;
  reading_interval_minutes: number;
};

type RangeKey = 'day' | 'week' | 'month';

type ConsumptionWindowApi = {
  range: RangeKey;
  start: string;
  end: string;
  total_kwh: number;
  daily_avg_kwh: number;
  reading_count: number;
  first_reading: string | null;
  last_reading: string | null;
  avg_wattage: number | null;
};

const devices = [
  { nameKey: 'dashboard.device.fridge', noteKey: 'dashboard.device.fridgeNote', kwh: 78, peso: 1090, Icon: KitchenIcon },
  { nameKey: 'dashboard.device.aircon', noteKey: 'dashboard.device.airconNote', kwh: 62, peso: 870, Icon: AcUnitIcon },
  { nameKey: 'dashboard.device.heat', noteKey: 'dashboard.device.heatNote', kwh: 38, peso: 530, Icon: LocalFireDepartmentIcon },
  { nameKey: 'dashboard.device.electronics', noteKey: 'dashboard.device.electronicsNote', kwh: 32, peso: 445, Icon: ComputerIcon },
  { nameKey: 'dashboard.device.other', noteKey: 'dashboard.device.otherNote', kwh: 24, peso: 335, Icon: PowerIcon },
];

function relativeTimeFrom(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function DashboardContent({
  userName,
  userAccount,
}: {
  userName: string;
  userAccount: string;
}) {
  const { t } = useLang();
  const ctx = t('dashboard.projectionContext', { amount: '__SIGNAL__' });
  const [ctxBefore, ctxAfter] = ctx.split('__SIGNAL__');
  const [range, setRange] = useState<RangeKey>('month');

  // React Query Fetchers
  // Anomalies poll every 20s so a freshly pushed Contract C alert surfaces
  // without the user manually refreshing.
  const { data: anomaliesData = [] } = useQuery<AnomalyApi[]>({
    queryKey: ['recentAnomalies'],
    queryFn: async () => {
      const res = await api.get('/analytics/recent-anomalies/');
      return res.data;
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const { data: billData = [] } = useQuery<BillVsTelemetryApi[]>({
    queryKey: ['consumptionIndicator'],
    queryFn: async () => {
      const res = await api.get('/analytics/bill-vs-telemetry/');
      return Array.isArray(res.data) ? res.data : [res.data];
    }
  });

  const { data: monthlyData = [] } = useQuery<MonthlyConsumptionApi[]>({
    queryKey: ['monthlyConsumption'],
    queryFn: async () => {
      const res = await api.get('/iot/monthly-consumption/');
      return res.data;
    }
  });

  // Live meter: most recent IoT reading. Poll every 10s. 204 = no readings.
  const { data: latestReading } = useQuery<LatestReadingApi | null>({
    queryKey: ['latestReading'],
    queryFn: async () => {
      const res = await api.get('/iot/readings/latest/');
      return res.status === 204 ? null : (res.data as LatestReadingApi);
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  // Consumption rollup for the active day/week/month tab. Refetches when
  // the user flips the range selector.
  const { data: windowData } = useQuery<ConsumptionWindowApi>({
    queryKey: ['consumptionWindow', range],
    queryFn: async () => {
      const res = await api.get<ConsumptionWindowApi>('/iot/consumption-window/', {
        params: { range },
      });
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const currentBill = billData.length > 0 ? billData[0] : null;
  const totalBillPhp = currentBill?.total_bill_php || 0;
  const kwhVariance = currentBill?.kwh_variance || 0;
  // Stats now come from the range-window endpoint so day/week/month tabs
  // change what's displayed. Falls back to monthly-consumption sum when
  // the window endpoint has no data yet.
  const monthlyTotalKwh = monthlyData.reduce((s, d) => s + d.kwh, 0);
  const windowTotalKwh = windowData?.total_kwh ?? 0;
  const windowDailyKwh = windowData?.daily_avg_kwh ?? 0;
  const hasWindowData = (windowData?.reading_count ?? 0) > 0;
  const hasMonthly = monthlyData.length > 0;
  const hasAnyData = hasWindowData || hasMonthly;

  // The stat panel respects the active range. For "Month" with no window
  // data, fall back to summed monthly aggregates so the user still sees
  // their bill-cycle totals from the materialized view.
  const displayTotalKwh = hasWindowData
    ? windowTotalKwh
    : range === 'month' && hasMonthly
      ? monthlyTotalKwh
      : null;
  const displayDailyKwh = hasWindowData
    ? windowDailyKwh
    : range === 'month' && hasMonthly
      ? monthlyTotalKwh / 30
      : null;
  const displayRate =
    displayTotalKwh && displayTotalKwh > 0 && totalBillPhp
      ? totalBillPhp / displayTotalKwh
      : null;

  const maxKwh = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.kwh)) : 1;

  const RANGE_OPTIONS: Array<{ key: RangeKey; labelKey: string }> = [
    { key: 'month', labelKey: 'dashboard.range.month' },
    { key: 'week', labelKey: 'dashboard.range.week' },
    { key: 'day', labelKey: 'dashboard.range.day' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
        <div>
          <p className="text-sm text-ink-2 font-medium">{t('dashboard.greeting', { name: userName })}</p>
          <p className="text-xs text-ink-3 mt-1 tabular">
            {t('dashboard.meta', { account: userAccount })}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Consumption range"
          className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-1 text-xs"
        >
          {RANGE_OPTIONS.map(opt => {
            const active = range === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(opt.key)}
                className={`px-3 py-1.5 rounded transition-colors ${
                  active
                    ? 'text-ink font-medium bg-elevated'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {anomaliesData.length > 0 && (
        <section
          aria-live="polite"
          className="mb-8 rounded-lg border border-signal-strong bg-signal-soft px-5 py-4 flex items-start gap-4"
        >
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-strong text-white">
            <WarningAmberIcon sx={{ fontSize: 22 }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-signal-strong tracking-tight">
              {anomaliesData.length === 1
                ? '1 active anomaly detected'
                : `${anomaliesData.length} active anomalies detected`}
            </p>
            <p className="text-sm text-ink mt-1 leading-relaxed">
              {anomaliesData[0].message}
            </p>
            <p className="text-xs text-ink-3 mt-1.5 tabular">
              {anomaliesData[0].device_id} &middot; {relativeTimeFrom(anomaliesData[0].timestamp)}
            </p>
          </div>
          <Link
            href="/reports"
            className="shrink-0 text-sm font-semibold text-signal-strong hover:underline"
          >
            View all &rarr;
          </Link>
        </section>
      )}

      <section className="mb-8 rounded-lg border border-line bg-surface px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            className={`relative inline-flex h-3 w-3 rounded-full shrink-0 ${
              latestReading ? 'bg-accent-strong' : 'bg-ink-3'
            }`}
            aria-hidden
          >
            {latestReading && (
              <span className="absolute inset-0 rounded-full bg-accent-strong animate-ping opacity-60" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider font-semibold text-ink-2">
              Live meter
            </p>
            {latestReading ? (
              <p className="text-sm text-ink-3 mt-0.5 tabular truncate">
                {latestReading.device_id} &middot; {relativeTimeFrom(latestReading.timestamp)}
              </p>
            ) : (
              <p className="text-sm text-ink-3 mt-0.5">No readings yet</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {latestReading ? (
            <>
              <p className="font-readout text-3xl text-ink leading-none tabular">
                {Math.round(latestReading.avg_wattage)}
                <span className="text-base text-ink-3 font-sans font-normal ml-1">W</span>
              </p>
              <p className="text-xs text-ink-3 mt-1 tabular">
                {latestReading.reading_interval_minutes}-min interval
              </p>
            </>
          ) : (
            <p className="font-readout text-3xl text-ink-3 leading-none">—</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-circuit px-8 py-10 mb-12">
        {!currentBill ? (
          <EmptyState 
            className="w-full h-full py-16"
            title="No Billing Data" 
            description={
              <>
                It seems you haven't added a bill yet. <Link href="/bills" className="text-accent hover:underline font-medium">Would you like to add one?</Link>
              </>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-12 gap-y-8 items-end">
            <div className="md:col-span-8">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-3">
                {t('dashboard.projectionLabel')}
              </p>
              <p className="font-readout text-7xl md:text-8xl text-ink leading-none">
                <span className="text-ink-3 align-top text-3xl md:text-4xl mr-1 font-normal font-sans">₱</span>
                {totalBillPhp.toLocaleString()}
              </p>
              <p className="text-base md:text-lg text-ink-2 mt-6 max-w-xl leading-relaxed">
                {ctxBefore}
                <span className="font-readout text-signal-strong">₱{kwhVariance}</span>
                {ctxAfter}
              </p>
            </div>

            <div className="md:col-span-4 grid grid-cols-3 md:grid-cols-1 gap-5 md:gap-6 md:border-l md:border-line-strong md:pl-10">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('dashboard.statConsumption')}
                </p>
                <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                  {displayTotalKwh !== null ? displayTotalKwh.toFixed(1) : '—'}{' '}
                  <span className="text-sm text-ink-3 font-sans font-normal">kWh</span>
                </p>
                <p className="text-xs text-ink-3 mt-1 tabular">
                  {range === 'day' ? 'last 24h' : range === 'week' ? 'last 7 days' : 'last 30 days'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('dashboard.statDaily')}
                </p>
                <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                  {displayDailyKwh !== null ? displayDailyKwh.toFixed(1) : '—'}{' '}
                  <span className="text-sm text-ink-3 font-sans font-normal">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('dashboard.statRate')}
                </p>
                <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                  <span className="text-ink-3 text-base font-sans font-normal">₱</span>
                  {displayRate !== null ? displayRate.toFixed(2) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-ink tracking-tight">
              {t('dashboard.anomaliesTitle')}
            </h2>
            <p className="text-sm text-ink-3 mt-1">{t('dashboard.anomaliesSub')}</p>
          </div>
          <Link href="/reports" className="text-sm text-accent hover:text-accent-strong font-medium">
            {t('common.viewAll')} &rarr;
          </Link>
        </div>

        {anomaliesData.length === 0 ? (
          <EmptyState 
            className="w-full py-12"
            title="No Anomalies Detected" 
            description="There are currently no usage anomalies reported." 
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {anomaliesData.map(a => (
              <li key={a.alert_id} className="py-5 flex gap-5 items-start">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-strong text-sm font-semibold">
                  !
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{a.device_id}</p>
                  <p className="text-sm text-ink-2 mt-1 leading-relaxed">{a.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-ink-3">Actual / Expected</p>
                  <p className="font-readout text-xl text-signal-strong mt-0.5 leading-none">
                    {a.actual_wattage} / {a.expected_wattage_range} W
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-12 mb-12 pb-12 border-b border-line">
        <div className="lg:col-span-7">
          <h2 className="font-display text-2xl text-ink tracking-tight mb-1">
            {t('dashboard.weeklyTitle')}
          </h2>
          <p className="text-sm text-ink-3 mb-8">{t('dashboard.weeklySub')}</p>

          {monthlyData.length === 0 ? (
           <EmptyState 
             className="w-full h-56"
             title="No Consumption Data" 
             description="Monthly consumption history is currently empty." 
           />
          ) : (
            <div className="h-56 flex items-end justify-between gap-3">
              {monthlyData.map(d => {
                const heightPct = (d.kwh / maxKwh) * 100;
                const isPeak = d.kwh === maxKwh;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <span className={`text-xs font-readout ${isPeak ? 'text-accent-strong' : 'text-ink-2'}`}>
                      {d.kwh.toFixed(1)}
                    </span>
                    <div className="w-full bg-elevated rounded-sm relative" style={{ height: '180px' }}>
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-sm transition-[height] duration-300 ${
                          isPeak ? 'bg-accent-strong' : 'bg-accent'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-3">
                      {new Date(d.month).toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 lg:pl-12 lg:border-l lg:border-line relative">
          <div className="absolute inset-0 left-0 lg:left-12 z-10 flex items-center justify-center bg-surface/50 backdrop-blur-[2px]">
            <span className="text-lg font-semibold text-ink tracking-tight">
              Coming Soon!
            </span>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink tracking-tight mb-1">
              {t('dashboard.breakdownTitle')}
            </h2>
            <p className="text-sm text-ink-3 mb-6">{t('dashboard.breakdownSub')}</p>

            <ul className="space-y-4">
              {devices.map(d => {
                const pct = totalKwh > 0 ? (d.kwh / totalKwh) * 100 : 0;
                return (
                  <li key={d.nameKey}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <d.Icon sx={{ fontSize: 18, color: 'var(--color-ink-3)' }} />
                      <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">
                        {t(d.nameKey)}
                      </span>
                      <span className="text-sm font-semibold text-ink tabular">₱{d.peso}</span>
                    </div>
                    <div className="flex items-center gap-3 pl-7">
                      <div className="flex-1 h-1 bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-3 tabular w-20 text-right">
                        {d.kwh} kWh
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="rounded-lg border border-line bg-surface px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg text-ink">{t('dashboard.chatBlockTitle')}</p>
            <p className="text-sm text-ink-2 mt-0.5">{t('dashboard.chatBlockBody')}</p>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
          >
            {t('dashboard.chatBlockCta')}
          </button>
        </div>
      </section>
    </div>
  );
}
