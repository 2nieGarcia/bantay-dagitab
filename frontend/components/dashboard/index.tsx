'use client';

import ComputerIcon from '@mui/icons-material/Computer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerIcon from '@mui/icons-material/Power';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import KitchenIcon from '@mui/icons-material/Kitchen';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DashboardCardTemplate } from '@/components/templates/DashboardCardTemplate';
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

const devices = [
  { nameKey: 'dashboard.device.fridge', noteKey: 'dashboard.device.fridgeNote', kwh: 78, peso: 1090, Icon: KitchenIcon },
  { nameKey: 'dashboard.device.aircon', noteKey: 'dashboard.device.airconNote', kwh: 62, peso: 870, Icon: AcUnitIcon },
  { nameKey: 'dashboard.device.heat', noteKey: 'dashboard.device.heatNote', kwh: 38, peso: 530, Icon: LocalFireDepartmentIcon },
  { nameKey: 'dashboard.device.electronics', noteKey: 'dashboard.device.electronicsNote', kwh: 32, peso: 445, Icon: ComputerIcon },
  { nameKey: 'dashboard.device.other', noteKey: 'dashboard.device.otherNote', kwh: 24, peso: 335, Icon: PowerIcon },
];

export default function DashboardContent() {
  const { t } = useLang();
  const ctx = t('dashboard.projectionContext', { amount: '__SIGNAL__' });
  const [ctxBefore, ctxAfter] = ctx.split('__SIGNAL__');

  // React Query Fetchers
  const { data: userProfile } = useQuery<UserProfileApi>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await api.get('/users/profile/');
      return res.data;
    }
  });

  const { data: anomaliesData = [] } = useQuery<AnomalyApi[]>({
    queryKey: ['recentAnomalies'],
    queryFn: async () => {
      const res = await api.get('/analytics/recent-anomalies/');
      return res.data;
    }
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
  const totalBillPhp = projectedBillPhp;
  const totalKwh = consumptionSoFarKwh || devices.reduce((s, d) => s + d.kwh, 0);

  const maxKwh = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.kwh)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
        <div>
          <p className="text-sm text-ink-2 font-medium">{t('dashboard.greeting', { name: userName })}</p>
          <p className="text-xs text-ink-3 mt-1 tabular">
            {t('dashboard.meta', { account: userAccount })}
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-1 text-xs">
          <button className="px-3 py-1.5 rounded text-ink font-medium bg-elevated">
            {t('dashboard.range.month')}
          </button>
          <button className="px-3 py-1.5 rounded text-ink-3 hover:text-ink-2 transition-colors">
            {t('dashboard.range.week')}
          </button>
          <button className="px-3 py-1.5 rounded text-ink-3 hover:text-ink-2 transition-colors">
            {t('dashboard.range.day')}
          </button>
        </div>
      </div>

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
                  {totalKwh} <span className="text-sm text-ink-3 font-sans font-normal">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('dashboard.statDaily')}
                </p>
                <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                  {(totalKwh / 30).toFixed(1)} <span className="text-sm text-ink-3 font-sans font-normal">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('dashboard.statRate')}
                </p>
                <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                  <span className="text-ink-3 text-base font-sans font-normal">₱</span>{totalKwh > 0 ? (totalBillPhp / totalKwh).toFixed(2) : 0}
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
            title={t('dashboard.empty.anomaliesTitle')} 
            description={t('dashboard.empty.anomaliesBody')} 
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
            {t('dashboard.weeklyTitle')}
          </h2>
          <p className="text-sm text-ink-3 mb-8">{t('dashboard.weeklySub')}</p>

          {monthlyData.length === 0 ? (
           <EmptyState 
             className="w-full h-56"
             title={t('dashboard.empty.monthlyTitle')} 
             description={t('dashboard.empty.monthlyBody')} 
           />
          ) : (
            <div className="h-56 flex items-end justify-between gap-3">
              {monthlyData.map(d => {
                const heightPct = (d.kwh / maxKwh) * 100;
                const isPeak = d.kwh === maxKwh;
                return (
                  <div key={d.period} className="flex-1 flex flex-col items-center gap-2 min-w-0">
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
                      {new Date(d.period).toLocaleString('default', { month: 'short' })}
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
