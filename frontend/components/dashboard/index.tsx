'use client';

import { useMemo, useState, memo } from 'react';
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
import { EmptyState } from '@/components/templates/EmptyState';

// API Response Types
type AnomalyApi = {
  alert_id: string;
  user_account_id: string;
  device_id: string;
  timestamp: string;
  alert_type: string;
  expected_wattage_range: string;
  actual_wattage: number;
  message: string;
  status: string;
};

type MonthlyConsumptionApi = {
  user_id: number;
  period: string;
  kwh: number;
};

type ConsumptionIndicatorApi = {
  projected_bill_php: number;
  consumption_so_far_kwh: number;
  budget_used_percentage: number;
  remaining_budget_php: number;
  current_load_watts: number;
};

type UserProfileApi = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

type BillHistoryApi = {
  id: number;
  user_account_id: string;
  scan_timestamp: string;
  meralco_account_number: string;
  billing_period: string;
  total_kwh_consumed: number;
  total_bill_php: number;
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

const RANGE_TO_MS: Record<RangeKey, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const RANGE_LABEL: Record<RangeKey, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
};

// Range → minutes window for the live sparkline.
const RANGE_TO_SPARKLINE_MIN: Record<RangeKey, number> = {
  day: 24 * 60,        // last 24h
  week: 7 * 24 * 60,   // last 7 days
  month: 30 * 24 * 60, // last 30 days (the maximum)
};

// Range → number of daily bars for the 'Use per day' chart.
const RANGE_TO_DAILY_BARS: Record<RangeKey, number> = {
  day: 1,
  week: 7,
  month: 30,
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

const Sparkline = memo(function Sparkline({ readings }: { readings: LatestReadingApi[] }) {
  // Render an SVG polyline scaled to the container. We use preserveAspectRatio
  // "none" so the chart stretches horizontally as the parent grows; vertical
  // stays proportional to the watt range so spikes are visible.
  const W = 800;
  const H = 80;

  const sparklineData = useMemo(() => {
    if (readings.length < 2) return null;
    
    const values = readings.map(r => r.avg_wattage);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = Math.max(maxV - minV, 50); // floor so flat lines render visibly
    
    const pts = readings
      .map((r, i) => {
        const x = (i / (readings.length - 1)) * W;
        const y = H - ((r.avg_wattage - minV) / span) * (H - 10) - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
      
    const lastX = W;
    const lastY = H - ((values[values.length - 1] - minV) / span) * (H - 10) - 5;
    
    return { pts, lastX, lastY };
  }, [readings]);

  if (!sparklineData) {
    return (
      <div className="h-20 w-full rounded-md border border-dashed border-line-strong flex items-center justify-center">
        <p className="text-xs text-ink-3">
          {readings.length === 0 ? 'Waiting for readings…' : 'Building up history…'}
        </p>
      </div>
    );
  }

  const { pts, lastX, lastY } = sparklineData;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-strong)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-accent-strong)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill="url(#sparkFill)"
      />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-accent-strong)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={3.5} fill="var(--color-accent-strong)" />
    </svg>
  );
});

export default function DashboardContent() {
  const { t } = useLang();
  const ctx = t('dashboard.projectionContext', { amount: '__SIGNAL__' });
  const [ctxBefore, ctxAfter] = ctx.split('__SIGNAL__');
  const [range, setRange] = useState<RangeKey>('month');

  // React Query Fetchers
  const { data: userProfile } = useQuery<UserProfileApi>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await api.get('/users/profile/');
      return res.data;
    }
  });

  // Anomalies use the ORM endpoint with status=active + a since=<cutoff>
  // matching the active range tab. This bypasses the SQL view's INNER JOIN
  // on users_profile (which would silently drop alerts for accounts without
  // a profile row) and doesn't depend on migration 0007 being applied.
  const sinceForRange = useMemo(
    () => new Date(Date.now() - RANGE_TO_MS[range]).toISOString(),
    [range],
  );
  const { data: anomaliesData = [] } = useQuery<AnomalyApi[]>({
    queryKey: ['anomalies-active', sinceForRange],
    queryFn: async () => {
      const res = await api.get<AnomalyApi[]>('/analytics/', {
        params: { status: 'active', since: sinceForRange },
      });
      return res.data;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: indicatorData } = useQuery<ConsumptionIndicatorApi>({
    queryKey: ['consumptionIndicator'],
    queryFn: async () => {
      const res = await api.get('/analytics/consumption-indicator/');
      return res.data;
    }
  });

  const { data: monthlyData = [] } = useQuery<MonthlyConsumptionApi[]>({
    queryKey: ['monthlyConsumption'],
    queryFn: async () => {
      const res = await api.get('/iot/monthly-consumption/');
      return res.data;
    }
  });

  const { data: billData = [] } = useQuery<BillHistoryApi[]>({
    queryKey: ['billingHistory'],
    queryFn: async () => {
      const res = await api.get('/billing/');
      return res.data;
    }
  });

  const userName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : '';
  const currentBill = billData.length > 0 ? billData[0] : null;
  const userAccount = currentBill?.meralco_account_number ? `Account: ${currentBill.meralco_account_number}` : '';

  const projectedBillPhp = indicatorData?.projected_bill_php || 0;
  const consumptionSoFarKwh = indicatorData?.consumption_so_far_kwh || 0;
  const totalKwh = consumptionSoFarKwh || devices.reduce((s, d) => s + d.kwh, 0);

  // Per-day kWh bars for the bottom 'Use per day' chart — driven by the
  // active range tab. Month = 30 bars, Week = 7, Today = 1.
  const dailyBars = RANGE_TO_DAILY_BARS[range];
  const { data: dailyData = [] } = useQuery<{ date: string; kwh: number }[]>({
    queryKey: ['consumptionDaily', dailyBars],
    queryFn: async () => {
      const res = await api.get<{ date: string; kwh: number }[]>(
        '/iot/consumption-daily/',
        { params: { days: dailyBars } },
      );
      return res.data;
    },
    refetchInterval: 30_000,
  });

  // Live meter sparkline. Window is driven by the active range tab so a
  // user viewing 'This month' sees up to 30 days of readings; 'Today'
  // shows the last 24 hours; 'Week' shows the last 7 days.
  const sparklineMinutes = RANGE_TO_SPARKLINE_MIN[range];
  const { data: recentReadings = [] } = useQuery<LatestReadingApi[]>({
    queryKey: ['recentReadings', sparklineMinutes],
    queryFn: async () => {
      const res = await api.get<LatestReadingApi[]>('/iot/readings/recent/', {
        params: { minutes: sparklineMinutes },
      });
      return res.data;
    },
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
  });
  const latestReading: LatestReadingApi | null =
    recentReadings.length > 0 ? recentReadings[recentReadings.length - 1] : null;

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

  // Anomalies are already server-filtered by `since=<range cutoff>`, so
  // this is just the same list — kept as a stable name for readability.
  const anomaliesInRange = anomaliesData;

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

      {anomaliesInRange.length > 0 && (
        <section
          aria-live="polite"
          className="mb-8 rounded-lg border border-signal-strong bg-signal-soft px-5 py-4 flex items-start gap-4"
        >
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-strong text-white">
            <WarningAmberIcon sx={{ fontSize: 22 }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-signal-strong tracking-tight">
              {anomaliesInRange.length === 1
                ? `1 active anomaly ${RANGE_LABEL[range]}`
                : `${anomaliesInRange.length} active anomalies ${RANGE_LABEL[range]}`}
            </p>
            <p className="text-sm text-ink mt-1 leading-relaxed">
              {anomaliesInRange[0].message}
            </p>
            <p className="text-xs text-ink-3 mt-1.5 tabular">
              {anomaliesInRange[0].device_id} &middot; {relativeTimeFrom(anomaliesInRange[0].timestamp)}
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

      <section className="mb-8 rounded-lg border border-line bg-surface px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            {(() => {
              // Determine IoT connection freshness:
              // - "live": latest reading is within the last 2 minutes (IoT device actively posting)
              // - "stale": latest reading exists but is older than 2 minutes
              // - "offline": no readings at all
              const now = Date.now();
              const latestTs = latestReading ? new Date(latestReading.timestamp).getTime() : 0;
              const ageMs = latestTs ? now - latestTs : Infinity;
              const isLive = ageMs < 10 * 1000;   // within 10 seconds
              const isStale = latestTs > 0 && !isLive;

              const dotColor = isLive
                ? 'bg-green-500'
                : isStale
                  ? 'bg-yellow-500'
                  : 'bg-ink-3';

              return (
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full shrink-0 ${dotColor}`}
                  aria-hidden
                >
                  {isLive && (
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
                  )}
                </span>
              );
            })()}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider font-semibold text-ink-2">
                {(() => {
                  const now = Date.now();
                  const latestTs = latestReading ? new Date(latestReading.timestamp).getTime() : 0;
                  const ageMs = latestTs ? now - latestTs : Infinity;
                  const isLive = ageMs < 10 * 1000;

                  if (isLive) {
                    return (
                      <>
                        <span className="text-green-600">● Live from IoT</span>
                        {' · '}
                        {range === 'day' ? 'last 24h' : range === 'week' ? 'last 7 days' : 'last 30 days'}
                      </>
                    );
                  }
                  return (
                    <>
                      Live meter &middot; {range === 'day' ? 'last 24h' : range === 'week' ? 'last 7 days' : 'last 30 days'}
                    </>
                  );
                })()}
              </p>
              {latestReading ? (
                <p className="text-sm text-ink-3 mt-0.5 tabular truncate">
                  {latestReading.device_id} &middot; {relativeTimeFrom(latestReading.timestamp)}
                </p>
              ) : (
                <p className="text-sm text-ink-3 mt-0.5">Waiting for IoT device data&hellip;</p>
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
                  {(latestReading.avg_wattage / 230).toFixed(2)} A &middot; {recentReadings.length} sample{recentReadings.length === 1 ? '' : 's'}
                </p>
              </>
            ) : (
              <p className="font-readout text-3xl text-ink-3 leading-none">&mdash;</p>
            )}
          </div>
        </div>

        <Sparkline readings={recentReadings} />

        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-3">
            Need to pump synthetic readings or trigger a spike?
          </p>
          <Link
            href="/simulator"
            className="text-xs font-semibold text-accent hover:text-accent-strong"
          >
            Open IoT simulator &rarr;
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-circuit px-8 py-10 mb-12">
        {!indicatorData ? (
          <EmptyState 
            className="w-full h-full py-16"
            title={t('dashboard.empty.billingTitle')} 
            description={
              <>
                {t('dashboard.empty.billingBody')} <Link href="/bills" className="text-accent hover:underline font-medium">{t('common.uploadBill')}</Link>
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
                <span className="font-readout text-signal-strong">₱{indicatorData?.remaining_budget_php || 0}</span>
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

        {anomaliesInRange.length === 0 ? (
          <EmptyState
            className="w-full py-12"
            title={t('dashboard.empty.anomaliesTitle')} 
            description={t('dashboard.empty.anomaliesBody')}
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {anomaliesInRange.map(a => (
              <li key={a.alert_id} className="py-5 flex gap-5 items-start">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-strong text-sm font-semibold">
                  !
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{a.device_id}</p>
                  <p className="text-sm text-ink-2 mt-1 leading-relaxed">{a.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-ink-3">{t('dashboard.anomalies.actualExpected')}</p>
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
            Use per day
          </h2>
          <p className="text-sm text-ink-3 mb-8">
            {range === 'day'
              ? "Today's consumption."
              : range === 'week'
                ? 'Daily kWh for the last 7 days.'
                : 'Daily kWh for the last 30 days.'}
          </p>

          {dailyData.length === 0 || dailyData.every(d => d.kwh === 0) ? (
            <EmptyState
              className="w-full h-56"
              title={t('dashboard.empty.monthlyTitle')}
              description={t('dashboard.empty.monthlyBody')}
            />
          ) : (
            (() => {
              const dailyMax = Math.max(1, ...dailyData.map(d => d.kwh));
              return (
                <div className="h-56 flex items-end justify-between gap-1.5">
                  {dailyData.map(d => {
                    const heightPct = (d.kwh / dailyMax) * 100;
                    const isPeak = d.kwh === dailyMax && dailyMax > 0;
                    const showLabel = dailyData.length <= 7;
                    const dateObj = new Date(d.date);
                    return (
                      <div
                        key={d.date}
                        title={`${d.date} · ${d.kwh.toFixed(2)} kWh`}
                        className="flex-1 flex flex-col items-center gap-2 min-w-0"
                      >
                        {showLabel && (
                          <span
                            className={`text-xs font-readout ${
                              isPeak ? 'text-accent-strong' : 'text-ink-2'
                            }`}
                          >
                            {d.kwh.toFixed(1)}
                          </span>
                        )}
                        <div
                          className="w-full bg-elevated rounded-sm relative"
                          style={{ height: '180px' }}
                        >
                          <div
                            className={`absolute bottom-0 left-0 right-0 rounded-sm transition-[height] duration-300 ${
                              isPeak ? 'bg-accent-strong' : 'bg-accent'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        {showLabel && (
                          <span className="text-xs text-ink-3">
                            {dateObj.toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        <div className="lg:col-span-5 lg:pl-12 lg:border-l lg:border-line relative">
          <div className="absolute inset-0 left-0 lg:left-12 z-10 flex items-center justify-center bg-surface/50 backdrop-blur-[2px]">
            <span className="text-lg font-semibold text-ink tracking-tight">
              {t('common.comingSoon')}
            </span>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink tracking-tight mb-1">
              {t('dashboard.breakdownTitle')}
            </h2>
            <p className="text-sm text-ink-3 mb-6">{t('dashboard.breakdownSub')}</p>

            <ul className="space-y-4">
              {devices.map(d => {
                const baseline = displayTotalKwh ?? monthlyTotalKwh;
                const pct = baseline > 0 ? (d.kwh / baseline) * 100 : 0;
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
