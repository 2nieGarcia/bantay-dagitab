'use client';

import Link from 'next/link';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WarningIcon from '@mui/icons-material/Warning';
import TuneIcon from '@mui/icons-material/Tune';

const cards = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    description: 'View your energy usage, anomalies, and device breakdowns.',
    Icon: DashboardIcon,
  },
  {
    href: '/bills',
    title: 'Bills',
    description: 'Upload and review OCR results from your MERALCO bills.',
    Icon: CreditCardIcon,
  },
  {
    href: '/reports',
    title: 'Reports',
    description: 'Inspect anomaly alerts and historical energy events.',
    Icon: WarningIcon,
  },
  {
    href: '/settings',
    title: 'Settings',
    description: 'Manage account preferences, notifications, and devices.',
    Icon: TuneIcon,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-cyan-400">
            BD
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/dashboard" className="text-sm text-slate-300 hover:text-cyan-400 transition">
              Dashboard
            </Link>
            <Link href="/bills" className="text-sm text-slate-300 hover:text-cyan-400 transition">
              Bills
            </Link>
            <Link href="/reports" className="text-sm text-slate-300 hover:text-cyan-400 transition">
              Reports
            </Link>
            <Link href="/settings" className="text-sm text-slate-300 hover:text-cyan-400 transition">
              Settings
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 transition"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-white sm:text-6xl">
              Control Your Energy
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl">
              Monitor your electricity usage, detect anomalies, and prevent unexpected bill shocks with Bantay Dagitab.
            </p>
            <div className="flex gap-3 pt-4">
              <Link
                href="/dashboard"
                className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold text-white hover:bg-cyan-600 transition"
              >
                Get Started
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-slate-600 px-6 py-2 font-semibold text-slate-100 hover:border-slate-500 transition"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="px-6 py-20 border-t border-slate-800">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-white mb-12">Our Services</h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {cards.map(card => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-lg border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500/50 hover:bg-slate-800 transition"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-cyan-400 group-hover:bg-cyan-500/20">
                  <card.Icon sx={{ fontSize: 20 }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm text-slate-500">© 2026 Bantay Dagitab. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
