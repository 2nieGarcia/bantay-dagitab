'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useBillContext } from '@/components/shared/bill-context';
import { useLang } from '@/lib/i18n';
import type { Bill } from '@/components/shared/types';

function confidenceTone(confidence: number) {
  if (confidence >= 95) return 'text-success';
  if (confidence >= 85) return 'text-accent';
  if (confidence >= 75) return 'text-ember';
  return 'text-signal-strong';
}

function ConfidencePill({ value }: { value: number }) {
  const tone = confidenceTone(value);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs tabular font-medium ${tone}`}>
      <span className="inline-block h-1 w-6 rounded-full bg-elevated overflow-hidden">
        <span className="block h-full bg-current" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      {Math.round(value)}%
    </span>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</dl>;
}

function Row({ label, value, full = false }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wider text-ink-3 font-medium mb-1">{label}</dt>
      <dd className="text-sm text-ink tabular">{value}</dd>
    </div>
  );
}

export default function BillsContent() {
  const [expandedBill, setExpandedBill] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedBills, setUploadedBills } = useBillContext();
  const { t } = useLang();
  const queryClient = useQueryClient();

  const { data: serverBills = [], isLoading: isLoadingBills } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const res = await api.get('/billing/');
      return res.data;
    },
  });

  const mappedServerBills: Bill[] = serverBills.map((b: any) => ({
    id: b.id || b.scan_timestamp,
    name: `Meralco Bill ${b.billing_period || 'Unknown'}`,
    status: 'completed',
    uploadDate: new Date(b.scan_timestamp || Date.now()).toLocaleDateString(),
    ocrConfidence: 100,
    extractedData: {
      accountDetails: {
        accountNumber: b.meralco_account_number || '',
        customerName: '',
        serviceAddress: '',
        meterNumber: '',
        confidence: 100,
      },
      billingPeriod: {
        startDate: b.billing_period || '',
        endDate: '',
        daysInPeriod: 30,
        readingDate: b.scan_timestamp || new Date().toISOString(),
        confidence: 100,
      },
      consumption: {
        previousReading: 0,
        currentReading: 0,
        totalkWh: b.total_kwh_consumed || 0,
        unit: 'kWh',
        confidence: 100,
      },
      charges: [],
      totalAmount: b.total_bill_php || 0,
      dueDate: '',
      confidence: 100,
    },
  }));

  const displayBills = [
    ...uploadedBills.filter(b => b.status === 'processing'),
    ...mappedServerBills,
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await api.post('/billing/ocr-upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        const data = res.data.extracted_data || {};
        const newBill: Bill = {
          id: Date.now(),
          name: file.name,
          status: 'processing',
          uploadDate: new Date().toLocaleDateString(),
          ocrConfidence: 90,
          extractedData: {
            accountDetails: {
              accountNumber: data.meralco_account_number || '',
              customerName: '',
              serviceAddress: '',
              meterNumber: '',
              confidence: 90,
            },
            billingPeriod: {
              startDate: data.billing_period || '',
              endDate: '',
              daysInPeriod: 30,
              readingDate: data.scan_timestamp || new Date().toISOString(),
              confidence: 90,
            },
            consumption: {
              previousReading: 0,
              currentReading: 0,
              totalkWh: data.total_kwh_consumed || 0,
              unit: 'kWh',
              confidence: 90,
            },
            charges: [],
            totalAmount: data.total_bill_php || 0,
            dueDate: '',
            confidence: 90,
          },
        };
        setUploadedBills(prev => [newBill, ...prev]);
        setExpandedBill(newBill.id);
      } else {
        alert(res.data.error_message || 'Failed to process bill image');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload bill.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const acceptMutation = useMutation({
    mutationFn: async (bill: Bill) => {
      const payload = {
        user_account_id: 1,
        scan_timestamp: bill.extractedData.billingPeriod.readingDate,
        meralco_account_number: bill.extractedData.accountDetails.accountNumber,
        billing_period: bill.extractedData.billingPeriod.startDate,
        total_kwh_consumed: bill.extractedData.consumption.totalkWh,
        total_bill_php: bill.extractedData.totalAmount,
      };
      return api.post('/billing/bills/', payload);
    },
    onSuccess: (res, bill) => {
      setUploadedBills(prev => prev.filter(b => b.id !== bill.id));
      queryClient.setQueryData(['bills'], (old: any) => [res.data, ...(old || [])]);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (err) => {
      console.error(err);
      alert('Failed to save bill.');
    }
  });

  const handleAccept = (bill: Bill) => {
    acceptMutation.mutate(bill);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink tracking-tight">{t('bills.title')}</h1>
          <p className="text-sm text-ink-2 mt-2 max-w-xl leading-relaxed">{t('bills.lede')}</p>
        </div>
        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:bg-ink-2 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <CloudUploadIcon sx={{ fontSize: 20 }} />
          {isUploading ? 'Uploading...' : 'Upload Bill'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {displayBills.length === 0 && !isLoadingBills ? (
        <div className="border border-line rounded-lg bg-surface px-8 py-12 text-center max-w-xl">
          <p className="font-display text-xl text-ink mb-2">{t('bills.empty.title')}</p>
          <p className="text-sm text-ink-2">{t('bills.empty.body')}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {displayBills.map(bill => {
            const isOpen = expandedBill === bill.id;
            return (
              <li key={bill.id} className="border border-line rounded-lg bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedBill(isOpen ? null : bill.id)}
                  className="w-full text-left px-6 py-5 hover:bg-elevated transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h2 className="font-display text-lg text-ink truncate">{bill.name}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-soft text-success">
                          {bill.status}
                        </span>
                      </div>
                      <p className="text-xs text-ink-3 mb-4 tabular">
                        {t('bills.uploaded')}: {bill.uploadDate}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1 inline-flex items-center gap-1">
                            <CalendarMonthIcon sx={{ fontSize: 13 }} /> {t('bills.period')}
                          </p>
                          <p className="text-sm text-ink tabular">
                            {bill.extractedData.billingPeriod.startDate}
                          </p>
                          <p className="text-xs text-ink-3 tabular">
                            → {bill.extractedData.billingPeriod.endDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1 inline-flex items-center gap-1">
                            <ElectricBoltIcon sx={{ fontSize: 13 }} /> {t('bills.consumption')}
                          </p>
                          <p className="text-sm text-ink tabular">
                            {bill.extractedData.consumption.totalkWh} kWh
                          </p>
                          <p className="text-xs text-ink-3 tabular">
                            {bill.extractedData.consumption.previousReading} → {bill.extractedData.consumption.currentReading}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1 inline-flex items-center gap-1">
                            <AttachMoneyIcon sx={{ fontSize: 13 }} /> {t('bills.total')}
                          </p>
                          <p className="font-readout text-base text-ink">
                            ₱{bill.extractedData.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-ink-3 tabular">
                            {t('bills.due')} {bill.extractedData.dueDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1 inline-flex items-center gap-1">
                            <PersonIcon sx={{ fontSize: 13 }} /> {t('bills.account')}
                          </p>
                          <p className="text-sm text-ink tabular truncate">
                            {bill.extractedData.accountDetails.accountNumber}
                          </p>
                          <p className="text-xs text-ink-3 truncate">
                            {bill.extractedData.accountDetails.customerName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs uppercase tracking-wider text-ink-3 font-medium">
                        {t('bills.confidence')}
                      </span>
                      <ConfidencePill value={bill.ocrConfidence} />
                      <span className={`text-ink-3 text-base transition-transform mt-2 ${isOpen ? 'rotate-180' : ''}`}>
                        ⌄
                      </span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-6 py-7 bg-page space-y-8">
                    <section>
                      <header className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-base text-ink inline-flex items-center gap-2">
                          <PersonIcon sx={{ fontSize: 16 }} /> {t('bills.accountSection')}
                        </h3>
                        <ConfidencePill value={bill.extractedData.accountDetails.confidence} />
                      </header>
                      <DL>
                        <Row label={t('bills.customerName')} value={bill.extractedData.accountDetails.customerName} />
                        <Row label={t('bills.accountNumber')} value={bill.extractedData.accountDetails.accountNumber} />
                        <Row label={t('bills.serviceAddress')} value={bill.extractedData.accountDetails.serviceAddress} full />
                        <Row label={t('bills.meterNumber')} value={bill.extractedData.accountDetails.meterNumber} />
                      </DL>
                    </section>

                    <section>
                      <header className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-base text-ink inline-flex items-center gap-2">
                          <CalendarMonthIcon sx={{ fontSize: 16 }} /> {t('bills.periodSection')}
                        </h3>
                        <ConfidencePill value={bill.extractedData.billingPeriod.confidence} />
                      </header>
                      <DL>
                        <Row label={t('bills.startDate')} value={bill.extractedData.billingPeriod.startDate} />
                        <Row label={t('bills.endDate')} value={bill.extractedData.billingPeriod.endDate} />
                        <Row label={t('bills.days')} value={bill.extractedData.billingPeriod.daysInPeriod} />
                        <Row label={t('bills.readingDate')} value={bill.extractedData.billingPeriod.readingDate} />
                      </DL>
                    </section>

                    <section>
                      <header className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-base text-ink inline-flex items-center gap-2">
                          <ElectricBoltIcon sx={{ fontSize: 16 }} /> {t('bills.consumptionSection')}
                        </h3>
                        <ConfidencePill value={bill.extractedData.consumption.confidence} />
                      </header>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1">{t('bills.previousReading')}</p>
                          <p className="font-readout text-2xl text-ink leading-none">
                            {bill.extractedData.consumption.previousReading}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3 mb-1">{t('bills.currentReading')}</p>
                          <p className="font-readout text-2xl text-ink leading-none">
                            {bill.extractedData.consumption.currentReading}
                          </p>
                        </div>
                        <div className="border-l border-line-strong pl-6">
                          <p className="text-xs uppercase tracking-wider text-accent mb-1 font-semibold">{t('bills.totalKwh')}</p>
                          <p className="font-readout text-2xl text-accent-strong leading-none">
                            {bill.extractedData.consumption.totalkWh}
                            <span className="text-sm font-sans text-ink-3 font-normal ml-1">kWh</span>
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <header className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-base text-ink inline-flex items-center gap-2">
                          <CreditCardIcon sx={{ fontSize: 16 }} /> {t('bills.chargesSection')}
                        </h3>
                      </header>
                      <ul className="divide-y divide-line border-y border-line mb-5">
                        {bill.extractedData.charges.map((c, i) => (
                          <li key={i} className="py-3 flex items-center justify-between gap-4">
                            <span className="text-sm text-ink">{c.description}</span>
                            <div className="flex items-center gap-4">
                              <span className="font-readout text-sm text-ink">
                                ₱{c.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="w-16 text-right">
                                <ConfidencePill value={c.confidence} />
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-end justify-between gap-4 pt-3 border-t-2 border-ink">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-ink-3">{t('bills.totalAmountDue')}</p>
                          <p className="font-readout text-4xl text-ink leading-none mt-1">
                            <span className="text-ink-3 align-top text-lg mr-0.5 font-normal font-sans">₱</span>
                            {bill.extractedData.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-ink-3">{t('bills.dueDate')}</p>
                          <p className="text-sm text-ink tabular mt-1">{bill.extractedData.dueDate}</p>
                        </div>
                      </div>
                    </section>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {bill.status === 'processing' && (
                        <button 
                          onClick={() => handleAccept(bill)}
                          disabled={acceptMutation.isPending}
                          className="px-4 py-2 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:bg-ink-2 transition-colors disabled:opacity-50"
                        >
                          {acceptMutation.isPending && acceptMutation.variables?.id === bill.id ? 'Accepting...' : t('bills.accept')}
                        </button>
                      )}
                      <button className="px-4 py-2 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors">
                        {t('bills.editDetails')}
                      </button>
                      <button className="ml-auto px-4 py-2 rounded-md text-sm font-medium text-signal-strong hover:bg-signal-soft transition-colors">
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
