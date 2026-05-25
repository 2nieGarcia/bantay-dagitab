'use client';

import LogoutIcon from '@mui/icons-material/Logout';
import { useLang, type Lang } from '@/lib/i18n';

function SettingsSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line rounded-lg bg-surface overflow-hidden">
      <header className="px-6 py-5 border-b border-line">
        <h2 className="font-display text-lg text-ink leading-tight">{title}</h2>
        {hint && <p className="text-sm text-ink-3 mt-1 leading-relaxed">{hint}</p>}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function LanguageChoice({
  value,
  current,
  label,
  hint,
  onSelect,
}: {
  value: Lang;
  current: Lang;
  label: string;
  hint: string;
  onSelect: (v: Lang) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left rounded-md border px-4 py-4 transition-colors ${
        active
          ? 'border-accent bg-accent-soft'
          : 'border-line hover:border-line-strong hover:bg-elevated'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1 inline-block h-4 w-4 rounded-full border-2 shrink-0 ${
            active ? 'border-accent-strong bg-accent-strong' : 'border-line-strong'
          }`}
        >
          {active && (
            <span className="block h-1.5 w-1.5 rounded-full bg-accent-ink mx-auto mt-0.75" />
          )}
        </span>
        <span className="flex-1">
          <span className={`block font-medium ${active ? 'text-accent-strong' : 'text-ink'}`}>
            {label}
          </span>
          <span className={`block text-xs mt-1 leading-relaxed ${active ? 'text-accent' : 'text-ink-3'}`}>
            {hint}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function SettingsContent() {
  const { t, lang, setLang } = useLang();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display text-4xl text-ink tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-ink-2 mt-2 leading-relaxed">{t('settings.lede')}</p>
      </div>

      <div className="space-y-5">
        <SettingsSection
          title={t('settings.section.language')}
          hint={t('settings.section.languageSub')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LanguageChoice
              value="en"
              current={lang}
              label={t('settings.language.english')}
              hint={t('settings.language.englishHint')}
              onSelect={setLang}
            />
            <LanguageChoice
              value="fil"
              current={lang}
              label={t('settings.language.filipino')}
              hint={t('settings.language.filipinoHint')}
              onSelect={setLang}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.account')}
          hint={t('settings.section.accountSub')}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">{t('settings.account.profile')}</p>
              <p className="text-sm text-ink-3 mt-1">{t('settings.account.profileBody')}</p>
            </div>
            <button className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
              {t('settings.account.editProfile')}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.notifications')}
          hint={t('settings.section.notificationsSub')}
        >
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-ink">{t('settings.notifications.emailAlerts')}</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-line-strong accent-(--color-accent)"
              />
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-ink">{t('settings.notifications.weeklyReport')}</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-line-strong accent-(--color-accent)"
              />
            </li>
          </ul>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.security')}
          hint={t('settings.section.securitySub')}
        >
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-ink">{t('settings.security.changePassword')}</span>
              <button className="text-sm text-accent hover:text-accent-strong font-medium">
                {t('common.edit')} &rarr;
              </button>
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-ink">{t('settings.security.twoFactor')}</span>
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-signal" />
                <span className="text-ink-3">{t('settings.security.twoFactorOff')}</span>
              </span>
            </li>
          </ul>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.iot')}
          hint={t('settings.section.iotSub')}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">{t('settings.iot.noneTitle')}</p>
              <p className="text-sm text-ink-3 mt-1 max-w-md leading-relaxed">
                {t('settings.iot.noneBody')}
              </p>
            </div>
            <button className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
              {t('settings.iot.add')}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection title={t('settings.section.data')} hint={t('settings.section.dataSub')}>
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-ink">{t('settings.data.export')}</span>
              <button className="text-sm text-accent hover:text-accent-strong font-medium">
                {t('common.edit')} &rarr;
              </button>
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-signal-strong">{t('settings.data.delete')}</span>
              <button className="text-sm text-signal-strong hover:text-signal font-medium">
                {t('common.delete')} &rarr;
              </button>
            </li>
          </ul>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.signOut')}
          hint={t('settings.section.signOutSub')}
        >
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
            <LogoutIcon sx={{ fontSize: 18 }} />
            {t('settings.signOut.cta')}
          </button>
        </SettingsSection>
      </div>
    </div>
  );
}
