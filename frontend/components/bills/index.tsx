'use client';

import { useState } from 'react';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useBillContext } from '@/components/shared/bill-context';

export default function BillsContent() {
  const [expandedBill, setExpandedBill] = useState<number | null>(null);
  const { uploadedBills } = useBillContext();

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'from-emerald-500/30 to-green-500/30 border-emerald-500/50 text-emerald-300';
    if (confidence >= 85) return 'from-cyan-500/30 to-blue-500/30 border-cyan-500/50 text-cyan-300';
    if (confidence >= 75) return 'from-yellow-500/30 to-orange-500/30 border-yellow-500/50 text-yellow-300';
    return 'from-red-500/30 to-orange-500/30 border-red-500/50 text-red-300';
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 95) return 'bg-gradient-to-r from-emerald-500 to-green-500';
    if (confidence >= 85) return 'bg-gradient-to-r from-cyan-500 to-blue-500';
    if (confidence >= 75) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-orange-500';
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Bills</h1>
      <p className="text-slate-400 text-sm mb-8">View bills analyzed through the AI chatbot. Upload bills directly to the chatbot for instant extraction and analysis.</p>

      <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-slate-600/50 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-lg font-semibold text-white mb-1">OCR Extraction Results</h2>
        <p className="text-sm text-slate-300 mb-6">Processed bills with extracted data and confidence scores</p>

        <div className="space-y-4">
          {uploadedBills.map(bill => (
            <div key={bill.id} className="border border-slate-600/50 rounded-2xl overflow-hidden transition-all duration-300 bg-slate-700/20 hover:shadow-lg hover:shadow-cyan-500/10">
              <button
                type="button"
                onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
                className="w-full p-6 flex items-start justify-between hover:bg-slate-700/30 transition-colors"
              >
                <div className="text-left flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircleIcon sx={{ fontSize: 28 }} />
                    <div>
                      <h3 className="font-semibold text-white text-lg">{bill.name}</h3>
                      <p className="text-xs text-slate-400">Uploaded: {bill.uploadDate}</p>
                    </div>
                    <span className="ml-4 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/40">
                      {bill.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">Overall OCR Confidence</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getConfidenceColor(bill.ocrConfidence)}`}>
                        {bill.ocrConfidence}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-600/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getConfidenceBarColor(bill.ocrConfidence)} transition-all duration-300`}
                        style={{ width: `${bill.ocrConfidence}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><CalendarMonthIcon sx={{ fontSize: 16 }} /> Period</p>
                      <p className="text-white font-medium">{bill.extractedData.billingPeriod.startDate}</p>
                      <p className="text-slate-500 text-xs">to {bill.extractedData.billingPeriod.endDate}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><ElectricBoltIcon sx={{ fontSize: 16 }} /> Consumption</p>
                      <p className="text-white font-medium">{bill.extractedData.consumption.totalkWh} kWh</p>
                      <p className="text-slate-500 text-xs">({bill.extractedData.consumption.previousReading} → {bill.extractedData.consumption.currentReading})</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><AttachMoneyIcon sx={{ fontSize: 16 }} /> Total</p>
                      <p className="text-white font-medium">₱{bill.extractedData.totalAmount}</p>
                      <p className="text-slate-500 text-xs">Due: {bill.extractedData.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><PersonIcon sx={{ fontSize: 16 }} /> Account</p>
                      <p className="text-white font-medium">{bill.extractedData.accountDetails.accountNumber}</p>
                      <p className="text-slate-500 text-xs">{bill.extractedData.accountDetails.customerName}</p>
                    </div>
                  </div>
                </div>

                <span className={`text-2xl text-slate-400 transition-transform duration-300 ml-4 flex-shrink-0 ${expandedBill === bill.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {expandedBill === bill.id && (
                <div className="border-t border-slate-600/50 p-6 space-y-6 bg-slate-800/30">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <PersonIcon sx={{ fontSize: 18 }} /> Account Details
                      <span className={`px-2 py-0.5 text-xs rounded border ${getConfidenceColor(bill.extractedData.accountDetails.confidence)}`}>
                        {bill.extractedData.accountDetails.confidence}%
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-1">Customer Name</p>
                        <p className="text-white font-mono">{bill.extractedData.accountDetails.customerName}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-1">Account Number</p>
                        <p className="text-white font-mono">{bill.extractedData.accountDetails.accountNumber}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50 col-span-2">
                        <p className="text-xs text-slate-400 mb-1">Service Address</p>
                        <p className="text-white font-mono text-sm">{bill.extractedData.accountDetails.serviceAddress}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-1">Meter Number</p>
                        <p className="text-white font-mono">{bill.extractedData.accountDetails.meterNumber}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <CalendarMonthIcon sx={{ fontSize: 18 }} /> Billing Period
                      <span className={`px-2 py-0.5 text-xs rounded border ${getConfidenceColor(bill.extractedData.billingPeriod.confidence)}`}>
                        {bill.extractedData.billingPeriod.confidence}%
                      </span>
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">Start Date</p>
                        <p className="text-white font-medium">{bill.extractedData.billingPeriod.startDate}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">End Date</p>
                        <p className="text-white font-medium">{bill.extractedData.billingPeriod.endDate}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">Days in Period</p>
                        <p className="text-white font-medium">{bill.extractedData.billingPeriod.daysInPeriod}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">Reading Date</p>
                        <p className="text-white font-medium">{bill.extractedData.billingPeriod.readingDate}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <ElectricBoltIcon sx={{ fontSize: 18 }} /> Consumption Details
                      <span className={`px-2 py-0.5 text-xs rounded border ${getConfidenceColor(bill.extractedData.consumption.confidence)}`}>
                        {bill.extractedData.consumption.confidence}%
                      </span>
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">Previous Reading</p>
                        <p className="text-white font-mono text-lg">{bill.extractedData.consumption.previousReading}</p>
                      </div>
                      <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
                        <p className="text-xs text-slate-400 mb-2">Current Reading</p>
                        <p className="text-white font-mono text-lg">{bill.extractedData.consumption.currentReading}</p>
                      </div>
                      <div className="bg-gradient-to-br from-cyan-500/20 to-sky-500/20 rounded-lg p-4 border border-cyan-500/50">
                        <p className="text-xs text-cyan-300 mb-2">Total Consumption</p>
                        <p className="text-cyan-100 font-mono text-2xl font-bold">{bill.extractedData.consumption.totalkWh} kWh</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><CreditCardIcon sx={{ fontSize: 18 }} /> Charges Breakdown</h4>
                    <div className="space-y-2 mb-4">
                      {bill.extractedData.charges.map((charge, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-700/40 rounded-lg border border-slate-600/50 hover:border-slate-500/70 transition-colors">
                          <div className="flex-1">
                            <p className="text-white font-medium">{charge.description}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-white font-mono font-semibold">₱{charge.amount.toFixed(2)}</p>
                            <span className={`px-2 py-1 text-xs rounded border ${getConfidenceColor(charge.confidence)}`}>
                              {charge.confidence}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-600/50 pt-4 flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 rounded-lg border border-cyan-500/40">
                      <p className="text-white font-bold text-lg">Total Amount Due</p>
                      <div className="flex items-center gap-4">
                        <p className="text-cyan-300 font-mono font-bold text-2xl">₱{bill.extractedData.totalAmount.toFixed(2)}</p>
                        <span className={`px-2 py-1 text-xs rounded border ${getConfidenceColor(bill.extractedData.confidence)}`}>
                          {bill.extractedData.confidence}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-slate-700/40 rounded-lg border border-slate-600/50">
                      <p className="text-xs text-slate-400 mb-1">Due Date</p>
                      <p className="text-white font-medium text-lg">{bill.extractedData.dueDate}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-600/50">
                    <button className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50">
                      Accept & Save
                    </button>
                    <button className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-all duration-200">
                      Edit Details
                    </button>
                    <button className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-all duration-200">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
