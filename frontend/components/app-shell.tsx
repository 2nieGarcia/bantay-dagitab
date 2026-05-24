'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WarningIcon from '@mui/icons-material/Warning';
import TuneIcon from '@mui/icons-material/Tune';
import ChatIcon from '@mui/icons-material/Chat';
import ChatPanel from '@/components/chat-panel';
import { BillProvider } from '@/components/shared/bill-context';
import type { Bill } from '@/components/shared/types';

const initialBills: Bill[] = [
  {
    id: 1,
    name: 'MERALCO Bill',
    status: 'completed',
    uploadDate: 'May 17, 2026',
    ocrConfidence: 92.5,
    extractedData: {
      accountDetails: {
        accountNumber: '123-456-7890',
        customerName: 'Juan Dela Cruz',
        serviceAddress: '123 Main Street, Manila, 1000',
        meterNumber: 'M-2026-001',
        confidence: 95,
      },
      billingPeriod: {
        startDate: 'Mar 15, 2026',
        endDate: 'Apr 14, 2026',
        daysInPeriod: 30,
        readingDate: 'Apr 14, 2026',
        confidence: 98,
      },
      consumption: {
        previousReading: 12450,
        currentReading: 12641,
        totalkWh: 191,
        unit: 'kWh',
        confidence: 97,
      },
      charges: [
        { description: 'Generation', amount: 1140.5, confidence: 94 },
        { description: 'Transmission', amount: 185.75, confidence: 92 },
        { description: 'Distribution', amount: 125.3, confidence: 91 },
        { description: 'System Loss', amount: 45.5, confidence: 89 },
        { description: 'Metering', amount: 15.0, confidence: 95 },
      ],
      totalAmount: 1482.05,
      dueDate: 'May 5, 2026',
      confidence: 96,
    },
  },
];

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/bills', label: 'Bills', Icon: CreditCardIcon },
  { href: '/reports', label: 'Reports', Icon: WarningIcon },
  { href: '/settings', label: 'Settings', Icon: TuneIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [uploadedBills, setUploadedBills] = useState<Bill[]>(initialBills);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const showShell = !['/', '/login', '/register'].includes(pathname);

  return (
    <BillProvider value={{ uploadedBills, setUploadedBills }}>
      <div className="min-h-screen text-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {showShell ? (
          <div className="flex h-screen overflow-hidden">
            <aside className="w-72 bg-slate-900/90 border-r border-slate-700/60 p-6 flex flex-col gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-semibold">Bantay Dagitab</p>
              </div>

              <nav className="space-y-2 flex-1">
                {navItems.map(({ href, label, Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                      }`}>
                      <Icon sx={{ fontSize: 20 }} />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="space-y-4 rounded-3xl border border-slate-700/50 bg-slate-800/70 p-5">
                <p className="text-sm font-semibold text-cyan-200">Connect IoT Device</p>
                <p className="text-xs text-slate-400">Link your energy monitoring hardware for live analytics.</p>
                <button className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-400">
                  Setup Device
                </button>
              </div>

              <div className="rounded-3xl border border-slate-700/50 bg-slate-800/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-200 font-bold">BD</div>
                  <div>
                    <p className="text-sm font-semibold text-white">User Name</p>
                    <p className="text-xs text-slate-400">Administrator</p>
                  </div>
                </div>
              </div>
            </aside>

            <div className={`relative flex-1 overflow-hidden bg-slate-950 transition-all duration-300 ${isChatOpen ? 'mr-[384px]' : ''}`}>
              <main className="h-full overflow-auto">{children}</main>

              <button
                type="button"
                onClick={() => setIsChatOpen(prev => !prev)}
                className={`fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-slate-300 shadow-lg transition-transform duration-300 hover:text-white hover:border-slate-500 ${
                  isChatOpen ? 'translate-x-[-28rem]' : ''
                }`}>
                <ChatIcon sx={{ fontSize: 28 }} />
              </button>

              <div className={`fixed top-0 right-0 z-30 h-full overflow-hidden bg-slate-950/95 shadow-2xl transition-all duration-300 ${
                isChatOpen ? 'w-[384px]' : 'w-0'
              }`}>
                <ChatPanel onClose={() => setIsChatOpen(false)} />
              </div>
            </div>
          </div>
        ) : (
          <main className="min-h-screen">{children}</main>
        )}
      </div>
    </BillProvider>
  );
}
