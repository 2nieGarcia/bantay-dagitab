'use client';

import ComputerIcon from '@mui/icons-material/Computer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PowerIcon from '@mui/icons-material/Power';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import KitchenIcon from '@mui/icons-material/Kitchen';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';

type Anomaly = {
  id: string;
  deviceKey: string;
  findingKey: string;
  extraPeso: number;
};

const anomalies: Anomaly[] = [
  { id: 'a1', deviceKey: 'dashboard.anomaly1.device', findingKey: 'dashboard.anomaly1.finding', extraPeso: 340 },
  { id: 'a2', deviceKey: 'dashboard.anomaly2.device', findingKey: 'dashboard.anomaly2.finding', extraPeso: 215 },
  { id: 'a3', deviceKey: 'dashboard.anomaly3.device', findingKey: 'dashboard.anomaly3.finding', extraPeso: 95 },
];

const devices = [
  { nameKey: 'dashboard.device.fridge', noteKey: 'dashboard.device.fridgeNote', kwh: 78, peso: 1090, Icon: KitchenIcon },
  { nameKey: 'dashboard.device.aircon', noteKey: 'dashboard.device.airconNote', kwh: 62, peso: 870, Icon: AcUnitIcon },
  { nameKey: 'dashboard.device.heat', noteKey: 'dashboard.device.heatNote', kwh: 38, peso: 530, Icon: LocalFireDepartmentIcon },
  { nameKey: 'dashboard.device.electronics', noteKey: 'dashboard.device.electronicsNote', kwh: 32, peso: 445, Icon: ComputerIcon },
  { nameKey: 'dashboard.device.other', noteKey: 'dashboard.device.otherNote', kwh: 24, peso: 335, Icon: PowerIcon },
];

const totalKwh = devices.reduce((s, d) => s + d.kwh, 0);

const weekly = [
  { day: 'Mon', kwh: 7.8 },
  { day: 'Tue', kwh: 8.4 },
  { day: 'Wed', kwh: 7.2 },
  { day: 'Thu', kwh: 9.1 },
  { day: 'Fri', kwh: 11.4 },
  { day: 'Sat', kwh: 12.6 },
  { day: 'Sun', kwh: 10.2 },
];
const maxKwh = Math.max(...weekly.map(d => d.kwh));

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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-12 gap-y-8 items-end">
          <div className="md:col-span-8">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-3">
              {t('dashboard.projectionLabel')}
            </p>
            <p className="font-readout text-7xl md:text-8xl text-ink leading-none">
              <span className="text-ink-3 align-top text-3xl md:text-4xl mr-1 font-normal font-sans">₱</span>
              2,847
            </p>
            <p className="text-base md:text-lg text-ink-2 mt-6 max-w-xl leading-relaxed">
              {ctxBefore}
              <span className="font-readout text-signal-strong">₱430</span>
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
                9.3 <span className="text-sm text-ink-3 font-sans font-normal">kWh</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                {t('dashboard.statRate')}
              </p>
              <p className="font-readout text-2xl text-ink mt-1.5 leading-none">
                <span className="text-ink-3 text-base font-sans font-normal">₱</span>12.16
              </p>
            </div>
          </div>
        </div>
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

        <ul className="divide-y divide-line border-y border-line">
          {anomalies.map(a => (
            <li key={a.id} className="py-5 flex gap-5 items-start">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-strong text-sm font-semibold">
                !
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{t(a.deviceKey)}</p>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">{t(a.findingKey)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-ink-3">{t('dashboard.extraOnBill')}</p>
                <p className="font-readout text-xl text-signal-strong mt-0.5 leading-none">
                  +₱{a.extraPeso}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-12 mb-12 pb-12 border-b border-line">
        <div className="lg:col-span-7">
          <h2 className="font-display text-2xl text-ink tracking-tight mb-1">
            {t('dashboard.weeklyTitle')}
          </h2>
          <p className="text-sm text-ink-3 mb-8">{t('dashboard.weeklySub')}</p>

          <div className="h-56 flex items-end justify-between gap-3">
            {weekly.map(d => {
              const heightPct = (d.kwh / maxKwh) * 100;
              const isPeak = d.kwh === maxKwh;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 min-w-0">
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
                  <span className="text-xs text-ink-3">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 lg:pl-12 lg:border-l lg:border-line">
          <h2 className="font-display text-2xl text-ink tracking-tight mb-1">
            {t('dashboard.breakdownTitle')}
          </h2>
          <p className="text-sm text-ink-3 mb-6">{t('dashboard.breakdownSub')}</p>

          <ul className="space-y-4">
            {devices.map(d => {
              const pct = (d.kwh / totalKwh) * 100;
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
