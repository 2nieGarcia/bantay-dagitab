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

function ComingSoonPill() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-elevated text-ink-3 border border-line">
      Coming soon
    </span>
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

import { useState } from 'react';
import Cookies from 'js-cookie';
import api from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function SettingsContent() {
  const { t, lang, setLang } = useLang();
  const queryClient = useQueryClient();

  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editMeralcoAccount, setEditMeralcoAccount] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await api.get('/users/profile/');
      return res.data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return api.put('/users/profile/', {
        user: {
          ...profile?.user,
          first_name: editFirstName,
          last_name: editLastName,
        },
        first_name: editFirstName,
        last_name: editLastName,
        meralco_account_number: editMeralcoAccount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setIsEditingAccount(false);
    },
  });

  const handleEditClick = () => {
    setEditFirstName(profile?.user?.first_name || '');
    setEditLastName(profile?.user?.last_name || '');
    setEditMeralcoAccount(profile?.meralco_account_number || '');
    setIsEditingAccount(true);
  };

  const handleCancelEdit = () => {
    setIsEditingAccount(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handleLogout = () => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    window.location.href = '/login';
  };

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
          {isEditingAccount ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">First name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-line-strong rounded-md text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Last name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-line-strong rounded-md text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Meralco Account Number</label>
                <input
                  type="text"
                  value={editMeralcoAccount}
                  onChange={(e) => setEditMeralcoAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-line-strong rounded-md text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium hover:bg-accent-strong transition-colors disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : t('common.save')}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  {profile?.user?.first_name ? `${profile.user.first_name} ${profile.user.last_name || ''}` : profile?.user?.username || t('settings.account.profile')}
                </p>
                <p className="text-sm text-ink-3 mt-1">{profile?.user?.email || t('settings.account.profileBody')}</p>
                <p className="text-sm text-ink-3 mt-1 tabular">Meralco Account: {profile?.meralco_account_number || 'Not set'}</p>
              </div>
              <button 
                onClick={handleEditClick}
                className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
              >
                {t('settings.account.editProfile')}
              </button>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.notifications')}
          hint={t('settings.section.notificationsSub')}
        >
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm text-ink-3">
                {t('settings.notifications.emailAlerts')}
                <ComingSoonPill />
              </span>
              <input
                type="checkbox"
                disabled
                className="h-4 w-4 rounded border-line-strong accent-(--color-accent) opacity-50 cursor-not-allowed"
              />
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm text-ink-3">
                {t('settings.notifications.weeklyReport')}
                <ComingSoonPill />
              </span>
              <input
                type="checkbox"
                disabled
                className="h-4 w-4 rounded border-line-strong accent-(--color-accent) opacity-50 cursor-not-allowed"
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
              <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-3">
                {t('settings.security.changePassword')}
                <ComingSoonPill />
              </span>
              <button
                disabled
                className="text-sm text-ink-3 font-medium opacity-50 cursor-not-allowed"
              >
                {t('common.edit')} &rarr;
              </button>
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-3">
                {t('settings.security.twoFactor')}
                <ComingSoonPill />
              </span>
              <span className="text-xs text-ink-3">
                {t('settings.security.twoFactorOff')}
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
              <p className="inline-flex items-center gap-2 text-sm font-medium text-ink-3">
                {t('settings.iot.noneTitle')}
                <ComingSoonPill />
              </p>
              <p className="text-sm text-ink-3 mt-1 max-w-md leading-relaxed">
                {t('settings.iot.noneBody')}
              </p>
            </div>
            <button
              disabled
              className="px-4 py-2 rounded-md border border-line text-sm font-medium text-ink-3 opacity-50 cursor-not-allowed"
            >
              {t('settings.iot.add')}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection title={t('settings.section.data')} hint={t('settings.section.dataSub')}>
          <ul className="divide-y divide-line">
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm text-ink-3">
                {t('settings.data.export')}
                <ComingSoonPill />
              </span>
              <button
                disabled
                className="text-sm text-ink-3 font-medium opacity-50 cursor-not-allowed"
              >
                {t('common.edit')} &rarr;
              </button>
            </li>
            <li className="py-3 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm text-ink-3">
                {t('settings.data.delete')}
                <ComingSoonPill />
              </span>
              <button
                disabled
                className="text-sm text-ink-3 font-medium opacity-50 cursor-not-allowed"
              >
                {t('common.delete')} &rarr;
              </button>
            </li>
          </ul>
        </SettingsSection>

        <SettingsSection
          title={t('settings.section.signOut')}
          hint={t('settings.section.signOutSub')}
        >
          <button onClick={handleLogout} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
            <LogoutIcon sx={{ fontSize: 18 }} />
            {t('settings.signOut.cta')}
          </button>
        </SettingsSection>
      </div>
    </div>
  );
}
