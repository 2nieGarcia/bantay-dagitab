'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/shared/brand';

export default function Home() {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-5">
          <Brand size="md" />
          <nav className="flex items-center gap-1">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
            >
              {t('common.signIn')}
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium rounded-md bg-ink text-ink-inverse hover:bg-ink-2 transition-colors"
            >
              {t('common.signUp')}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10 items-end">
          <div className="lg:col-span-8">
            <p className="text-xs uppercase tracking-[0.18em] font-medium text-ember mb-5">
              {t('home.kicker')}
            </p>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-ink leading-[1.02] tracking-tight">
              {t('home.headline1')}
              <br />
              <span className="italic text-ink-warm">{t('home.headline2')}</span>
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="text-base text-ink-2 leading-relaxed max-w-md">{t('home.lede')}</p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors"
              >
                {t('common.openDashboard')}
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/bills"
                className="inline-flex items-center px-5 py-3 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
              >
                {t('common.uploadBill')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-hero border-y border-line paper-grain">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.18em] font-medium text-ink-3 mb-10">
            {t('home.sampleLabel')}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-end">
            <div className="lg:col-span-8">
              <p className="text-sm text-ink-2 mb-3 font-medium">{t('home.sample.projection')}</p>
              <p className="font-display text-7xl md:text-8xl text-ink tracking-tight tabular leading-none">
                <span className="text-ink-3 align-top text-3xl md:text-4xl mr-1 font-normal">₱</span>
                2,847
              </p>
              <p className="text-base md:text-lg text-ink-2 mt-6 max-w-xl leading-relaxed">
                {t('home.sample.context', { amount: '' }).split('{amount}')[0]}
                <span className="font-semibold text-signal-strong tabular">₱430</span>
                {t('home.sample.context', { amount: '' }).split('{amount}')[1]}
              </p>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-6 lg:gap-8 lg:border-l lg:border-line-strong lg:pl-12">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-medium">
                  {t('home.sample.consumption')}
                </p>
                <p className="font-display text-3xl text-ink mt-2 tabular leading-none">
                  234 <span className="text-base text-ink-3 font-sans font-normal">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-medium">
                  {t('home.sample.alerts')}
                </p>
                <p className="font-display text-3xl text-signal-strong mt-2 leading-none">
                  {t('home.sample.alertsValue')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12">
          {[
            { num: '01', titleKey: 'home.feature1.title', bodyKey: 'home.feature1.body' },
            { num: '02', titleKey: 'home.feature2.title', bodyKey: 'home.feature2.body' },
            { num: '03', titleKey: 'home.feature3.title', bodyKey: 'home.feature3.body' },
          ].map(f => (
            <div key={f.num}>
              <p className="font-display text-3xl text-ember mb-3 leading-none">{f.num}</p>
              <h3 className="text-lg font-semibold text-ink mb-3 tracking-tight">{t(f.titleKey)}</h3>
              <p className="text-sm text-ink-2 leading-relaxed">{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brand size="sm" href={null} />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-6">
            <p className="text-xs text-ink-3">{t('home.footer.school')}</p>
            <p className="text-xs text-ink-3">{t('home.footer.sdg')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
