'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/shared/brand';
import api from '@/lib/api';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const res = await api.post('/token/', { username: email, password });
      if (res.data.access) {
        Cookies.set('access_token', res.data.access, { path: '/' });
        if (res.data.refresh) Cookies.set('refresh_token', res.data.refresh, { path: '/' });

        // Check whether the household has linked their MERALCO account + device.
        // If not, send them through onboarding before the dashboard.
        try {
          const profileRes = await api.get('/users/profile/');
          if (!profileRes.data?.has_completed_onboarding) {
            router.push('/onboarding');
            return;
          }
        } catch {
          // If the profile fetch fails, default to dashboard — middleware will
          // re-gate as needed.
        }
        router.push('/dashboard');
      }
    } catch {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Brand size="md" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            {t('common.backHome')}
          </Link>
        </div>
      </header>

      <div className="flex-1 mx-auto max-w-6xl w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12 items-center">
        <div className="hidden lg:block">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-5">
            {t('home.kicker')}
          </p>
          <h1 className="font-display text-5xl xl:text-6xl text-ink tracking-tight leading-[1.05]">
            {t('login.title')}.
          </h1>
          <p className="text-base text-ink-2 mt-5 max-w-md leading-relaxed">{t('login.lede')}</p>
        </div>

        <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          <div className="lg:hidden mb-8">
            <h1 className="font-display text-4xl text-ink tracking-tight">{t('login.title')}</h1>
            <p className="text-sm text-ink-2 mt-2">{t('login.lede')}</p>
          </div>

          <div className="border border-line rounded-lg bg-surface p-8">
            <form className="space-y-5" onSubmit={handleLogin}>
              {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2">
                  {t('common.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('login.placeholder.email')}
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2">
                  {t('common.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('login.placeholder.password')}
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : t('login.submit')}
              </button>
            </form>

            <p className="text-center text-sm text-ink-3 mt-6">
              {t('login.noAccount')}{' '}
              <Link href="/register" className="text-accent hover:text-accent-strong font-medium">
                {t('login.registerLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
