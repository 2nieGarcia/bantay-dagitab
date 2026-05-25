'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import WarningIcon from '@mui/icons-material/Warning';
import TuneIcon from '@mui/icons-material/Tune';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ChatPanel from '@/components/chat-panel';
import { BillProvider } from '@/components/shared/bill-context';
import { Brand } from '@/components/shared/brand';
import type { Bill } from '@/components/shared/types';
import { useLang } from '@/lib/i18n';

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
  { href: '/dashboard', labelKey: 'nav.dashboard', subKey: 'nav.dashboard.sub', Icon: DashboardIcon },
  { href: '/bills', labelKey: 'nav.bills', subKey: 'nav.bills.sub', Icon: CreditCardIcon },
  { href: '/reports', labelKey: 'nav.reports', subKey: 'nav.reports.sub', Icon: WarningIcon },
  { href: '/settings', labelKey: 'nav.settings', subKey: 'nav.settings.sub', Icon: TuneIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [uploadedBills, setUploadedBills] = useState<Bill[]>(initialBills);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const showShell = !['/', '/login', '/register'].includes(pathname);
  const { t } = useLang();

  return (
    <BillProvider value={{ uploadedBills, setUploadedBills }}>
      {showShell ? (
        <div className="flex min-h-screen bg-page text-ink">
          <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-line bg-surface">
            <div className="px-6 pt-8 pb-7 border-b border-line">
              <Brand size="md" />
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {navItems.map(({ href, labelKey, subKey, Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ${
                      isActive
                        ? 'bg-accent-soft text-accent-strong'
                        : 'text-ink-2 hover:bg-elevated hover:text-ink'
                    }`}
                  >
                    <Icon sx={{ fontSize: 20, marginTop: '2px' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{t(labelKey)}</span>
                      <span className={`block text-xs leading-tight mt-0.5 ${isActive ? 'text-accent' : 'text-ink-3'}`}>
                        {t(subKey)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="px-6 py-5 border-t border-line">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-ink text-ink-inverse flex items-center justify-center text-sm font-semibold font-display">
                  JD
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">Juan Dela Cruz</p>
                  <p className="text-xs text-ink-3 tabular">Acct ***3530</p>
                </div>
              </div>
            </div>
          </aside>

          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface">
            <ul className="grid grid-cols-4">
              {navItems.map(({ href, labelKey, Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex flex-col items-center gap-1 py-3 text-[11px] ${
                        isActive ? 'text-accent-strong' : 'text-ink-3'
                      }`}
                    >
                      <Icon sx={{ fontSize: 22 }} />
                      <span>{t(labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={`flex-1 min-w-0 transition-[margin] duration-300 ${isChatOpen ? 'lg:mr-100' : ''}`}>
            <main className="pb-24 md:pb-12">{children}</main>
          </div>

          <button
            type="button"
            onClick={() => setIsChatOpen(v => !v)}
            aria-label={isChatOpen ? 'Close chat' : t('chat.title')}
            className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-elevated transition-colors duration-150 ${
              isChatOpen ? 'lg:right-104' : ''
            }`}
          >
            {isChatOpen ? <CloseIcon sx={{ fontSize: 18 }} /> : <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
            <span>{isChatOpen ? 'Close' : t('chat.title')}</span>
          </button>

          <div
            className={`fixed top-0 right-0 z-40 h-full overflow-hidden border-l border-line bg-surface shadow-lg transition-[width] duration-300 ${
              isChatOpen ? 'w-full sm:w-100' : 'w-0'
            }`}
          >
            {isChatOpen && <ChatPanel onClose={() => setIsChatOpen(false)} />}
          </div>
        </div>
      ) : (
        <main className="min-h-screen bg-page text-ink">{children}</main>
      )}
    </BillProvider>
  );
}
