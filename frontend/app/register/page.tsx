'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Cookies from 'js-cookie';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/shared/brand';
import api from '@/lib/api';

export default function RegisterPage() {
  const { t } = useLang();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await api.post('/users/register/', {
        username: email,
        email,
        password,
        first_name: firstName,
        last_name: lastName
      });

      // Auto-login so the new user lands on the onboarding flow with credentials
      // already set. If anything in this leg fails, fall back to the login page
      // — the account itself was created successfully.
      try {
        const tokenRes = await api.post('/token/', { username: email, password });
        if (tokenRes.data.access) {
          Cookies.set('access_token', tokenRes.data.access, { path: '/' });
          if (tokenRes.data.refresh) {
            Cookies.set('refresh_token', tokenRes.data.refresh, { path: '/' });
          }
          router.push('/onboarding');
          return;
        }
      } catch {
        // fall through to /login
      }
      router.push('/login');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let detail = 'Registration failed. Please try again.';
      if (data && typeof data === 'object') {
        if (typeof data.detail === 'string') {
          detail = data.detail;
        } else {
          // DRF serializer errors come back as { field: ["message", ...] }
          const firstField = Object.entries(data)[0];
          if (firstField) {
            const [, value] = firstField;
            if (Array.isArray(value) && typeof value[0] === 'string') {
              detail = value[0];
            } else if (typeof value === 'string') {
              detail = value;
            }
          }
        }
      }
      setError(detail);
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
            {t('register.title')}.
          </h1>
          <p className="text-base text-ink-2 mt-5 max-w-md leading-relaxed">{t('register.lede')}</p>
        </div>

        <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          <div className="lg:hidden mb-8">
            <h1 className="font-display text-4xl text-ink tracking-tight">{t('register.title')}</h1>
            <p className="text-sm text-ink-2 mt-2">{t('register.lede')}</p>
          </div>

          <div className="border border-line rounded-lg bg-surface p-8">
            <form className="space-y-5" onSubmit={handleRegister}>
              {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
              <div>
                <label htmlFor="name" className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2">
                  {t('common.fullName')}
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Juan Dela Cruz"
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  autoComplete="name"
                />
              </div>

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
                  autoComplete="new-password"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="h-4 w-4 mt-0.5 rounded border-line-strong accent-(--color-accent) shrink-0"
                />
                <span className="text-sm text-ink-2 leading-relaxed">{t('register.terms')}</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Registering...' : t('register.submit')}
              </button>
            </form>

            <p className="text-center text-sm text-ink-3 mt-6">
              {t('register.haveAccount')}{' '}
              <Link href="/login" className="text-accent hover:text-accent-strong font-medium">
                {t('register.loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
