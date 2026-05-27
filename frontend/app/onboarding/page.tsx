'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/shared/brand';
import api from '@/lib/api';

export default function OnboardingPage() {
  const { t } = useLang();
  const router = useRouter();

  const [meralcoAccount, setMeralcoAccount] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAccount = meralcoAccount.trim();
    const trimmedDevice = deviceId.trim();

    if (!trimmedAccount || !trimmedDevice) {
      setError(t('onboarding.errorRequired'));
      return;
    }
    const digits = trimmedAccount.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t('onboarding.errorAccountLength'));
      return;
    }

    setError('');
    setSaving(true);
    try {
      await api.patch('/users/profile/', {
        meralco_account_number: digits,
        device_id: trimmedDevice,
      });
      router.push('/dashboard');
    } catch (err) {
      const error = err as any;
      if (error.response?.data) {
        const data = error.response.data;
        const messages = Object.values(data).flat();
        setError(messages.length > 0 ? String(messages[0]) : t('onboarding.errorGeneral'));
      } else {
        setError(t('onboarding.errorGeneral'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Brand size="md" />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-ink-3 hover:text-ink-2 transition-colors"
          >
            {t('onboarding.skip')}
          </Link>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-xl px-6 py-12">
        <h1 className="font-display text-4xl text-ink tracking-tight leading-[1.1]">
          {t('onboarding.title')}
        </h1>
        <p className="text-sm text-ink-2 mt-3 leading-relaxed">
          {t('onboarding.lede')}
        </p>

        <div className="mt-10 border border-line rounded-lg bg-surface p-8">
          <form className="space-y-6" onSubmit={submit}>
            {error && (
              <p className="text-sm text-signal-strong leading-relaxed">{error}</p>
            )}

            <div>
              <label
                htmlFor="meralco_account_number"
                className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
              >
                {t('onboarding.meralcoLabel')}
              </label>
              <input
                id="meralco_account_number"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={13}
                value={meralcoAccount}
                onChange={e => setMeralcoAccount(e.target.value)}
                placeholder={t('onboarding.meralcoPlaceholder')}
                className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink tabular placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                autoComplete="off"
              />
              <p className="text-xs text-ink-3 mt-1.5">{t('onboarding.meralcoHint')}</p>
            </div>

            <div>
              <label
                htmlFor="device_id"
                className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
              >
                {t('onboarding.deviceLabel')}
              </label>
              <input
                id="device_id"
                type="text"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder={t('onboarding.devicePlaceholder')}
                className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                autoComplete="off"
              />
              <p className="text-xs text-ink-3 mt-1.5">{t('onboarding.deviceHint')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors disabled:opacity-50"
              >
                {saving ? t('onboarding.submitting') : t('onboarding.submit')}
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 text-sm font-medium text-ink-3 hover:text-ink-2 transition-colors"
              >
                {t('onboarding.skip')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
