'use client';

import React, { useState } from 'react';
import { keyframes } from '@emotion/react';
import Badge from '@mui/material/Badge';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CircleNotificationsIcon from '@mui/icons-material/CircleNotifications';
import SecurityIcon from '@mui/icons-material/Security';
import FolderIcon from '@mui/icons-material/Folder';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ComputerIcon from '@mui/icons-material/Computer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PowerIcon from '@mui/icons-material/Power';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import TableChartIcon from '@mui/icons-material/TableChart';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import ChatIcon from '@mui/icons-material/Chat';

type TabType = 'dashboard' | 'upload-bills' | 'anomaly' | 'settings';

interface Bill {
  id: number;
  name: string;
  status: 'completed' | 'processing';
  uploadDate: string;
  ocrConfidence: number;
  extractedData: {
    accountDetails: {
      accountNumber: string;
      customerName: string;
      serviceAddress: string;
      meterNumber: string;
      confidence: number;
    };
    billingPeriod: {
      startDate: string;
      endDate: string;
      daysInPeriod: number;
      readingDate: string;
      confidence: number;
    };
    consumption: {
      previousReading: number;
      currentReading: number;
      totalkWh: number;
      unit: string;
      confidence: number;
    };
    charges: Array<{ description: string; amount: number; confidence: number }>;
    totalAmount: number;
    dueDate: string;
    confidence: number;
  };
}

// pulse animation sa warning sign
const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userName] = useState('User');
  const [userAccount] = useState('Account: ***-***-3530');
  const [uploadedBills, setUploadedBills] = useState<Bill[]>([
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
          confidence: 95
        },
        billingPeriod: {
          startDate: 'Mar 15, 2026',
          endDate: 'Apr 14, 2026',
          daysInPeriod: 30,
          readingDate: 'Apr 14, 2026',
          confidence: 98
        },
        consumption: {
          previousReading: 12450,
          currentReading: 12641,
          totalkWh: 191,
          unit: 'kWh',
          confidence: 97
        },
        charges: [
          { description: 'Generation', amount: 1140.50, confidence: 94 },
          { description: 'Transmission', amount: 185.75, confidence: 92 },
          { description: 'Distribution', amount: 125.30, confidence: 91 },
          { description: 'System Loss', amount: 45.50, confidence: 89 },
          { description: 'Metering', amount: 15.00, confidence: 95 },
        ],
        totalAmount: 1482.05,
        dueDate: 'May 5, 2026',
        confidence: 96
      }
    },
  ]);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <DashboardContent userName={userName} userAccount={userAccount} />;
      case 'upload-bills':
        return <UploadBillsContent uploadedBills={uploadedBills} />;
      case 'anomaly':
        return <AnomalyDetectionContent />;
      case 'settings':
        return <SettingsContent />;
      default:
        return <DashboardContent userName={userName} userAccount={userAccount} />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <aside className="w-64 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm border-r border-slate-700/50 p-8 flex flex-col">
        <div className="mb-8">
          <h1 className="text-sm font-bold uppercase tracking-widest text-slate-200">Bantay Dagitab</h1>
        </div>

        <nav className="space-y-1 flex-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-slate-400 hover:text-slate-300'
            }`}>
            <DashboardIcon sx={{ fontSize: 20 }} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('upload-bills')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'upload-bills'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-slate-400 hover:text-slate-300'
            }`}>
            <CreditCardIcon sx={{ fontSize: 20 }} />
            Bills
          </button>
          <button 
            onClick={() => setActiveTab('anomaly')}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'anomaly'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-slate-400 hover:text-slate-300'
            }`}>
            <div className="flex items-center gap-3">
              <WarningIcon sx={{ fontSize: 20 }} />
              Reports
            </div>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'settings'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-slate-400 hover:text-slate-300'
            }`}>
            <TuneIcon sx={{ fontSize: 20 }} />
            Settings
          </button>
        </nav>

        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-br from-cyan-500/15 to-sky-500/15 rounded-xl border border-cyan-500/25 hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300">
            <p className="text-sm font-semibold text-cyan-100 mb-2">Connect IoT Device</p>
            <p className="text-xs text-slate-400 mb-4">Link your energy monitoring hardware</p>
            <button className="w-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white text-sm font-semibold py-2.5 rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-200">
              Setup Device
            </button>
          </div>

          {/* Account Info */}
          <div className="flex items-center gap-3 px-4 py-4 bg-slate-700/20 rounded-lg border border-slate-600/30">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-sky-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              BD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">User Name</p>
              <p className="text-xs text-slate-400 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Floating Chat Head - Bottom Right */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-8 w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 rounded-full shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 flex items-center justify-center transition-all duration-500 hover:scale-110 z-50 border-2 border-purple-400/30 ${isChatOpen ? 'right-[416px]' : 'right-8'}`}>
        <ChatIcon sx={{ fontSize: 32, color: 'white' }} />
      </button>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {renderContent()}
        </main>

        {/* AI Chat Panel */}
        <div className={`bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-md border-l border-slate-700/50 flex flex-col flex-shrink-0 transition-all duration-500 ease-in-out overflow-hidden ${isChatOpen ? 'w-96' : 'w-0'}`}>
          <ChatPanel onClose={() => setIsChatOpen(false)} setUploadedBills={setUploadedBills} uploadedBills={uploadedBills} />
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ userName, userAccount }: { userName: string; userAccount: string }) {
  return (
    <div className="p-8">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold text-white mb-2">Welcome back, {userName}</h1>
        <p className="text-slate-400 text-sm">{userAccount}</p>
        <p className="text-slate-500 text-xs mt-4">Energy Monitoring Dashboard</p>
      </div>

      {/* Anomaly Alert Notification */}
      <div className="mb-8 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-2xl p-6 shadow-lg shadow-red-500/20">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <WarningIcon sx={{ fontSize: 32, color: '#fca5a5', animation: `${pulseAnimation} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` }} />
            <div>
              <h3 className="text-lg font-semibold text-red-200 mb-2">3 Active Anomalies Detected</h3>
              <p className="text-sm text-red-100 mb-3">Your energy consumption shows unusual patterns. Review them to avoid unexpected charges.</p>
              <button className="inline-block bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-red-500/30 hover:shadow-red-500/50">
                View Anomalies →
              </button>
            </div>
          </div>
          <button className="text-red-300 hover:text-red-200 text-2xl">×</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6" style={{ gridAutoRows: "auto" }}>
        {/* Energy Consumption */}
        <div className="col-span-1 row-span-2 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <h2 className="text-lg font-semibold text-white mb-6">Energy Consumption</h2>
          <input type="date" defaultValue="2026-04-22" className="w-full px-4 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-sm text-white mb-6" />
          
          {/* Circular Chart */}
          <div className="flex justify-center mb-8">
            <svg viewBox="0 0 120 120" className="w-32 h-32">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#94a3b8" strokeWidth="3" opacity="0.3" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#grad)" strokeWidth="3" strokeDasharray="132.8 314" strokeLinecap="round" transform="rotate(-90 60 60)" />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <text x="60" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">11kWh</text>
              <text x="60" y="80" textAnchor="middle" fontSize="12" fill="#cbd5e1">This month</text>
            </svg>
          </div>

          {/* Time Data */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-400 px-2">
              <span>Time</span>
              <span>Consumption (kWh)</span>
            </div>
            {[
              { time: '00:00', val: '0.23', trend: 'up', pct: '1%', color: 'emerald' },
              { time: '02:00', val: '0.25', trend: 'up', pct: '8%', color: 'emerald' },
              { time: '04:00', val: '0.28', trend: 'down', pct: '12%', color: 'red' },
              { time: '06:00', val: '3.22', trend: 'up', pct: '15%', color: 'emerald' },
              { time: '08:00', val: '1.18', trend: 'down', pct: '10%', color: 'red' },
              { time: '10:00', val: '1.73', trend: 'up', pct: '13%', color: 'emerald' },
              { time: '12:00', val: '1.63', trend: 'down', pct: '5%', color: 'red' },
            ].map(item => (
              <div key={item.time} className="flex justify-between items-center px-2 py-1.5 hover:bg-slate-600/30 rounded text-sm">
                <span className="text-slate-400">{item.time}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{item.val}</span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${item.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    <span>{item.trend === 'up' ? '↑' : '↓'}</span>
                    <span>{item.pct}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total kWh */}
        <div className="col-span-1 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-sm text-slate-400 mb-3">Total kWh</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">22kWh</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>

        {/* Price */}
        <div className="col-span-1 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-sm text-slate-400 mb-3">Price</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">₱1M</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>

        {/* Device Breakdown */}
        <div className="col-span-1 row-span-2 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <h2 className="text-lg font-semibold text-white mb-6">Device Breakdown</h2>
          <div className="space-y-3">
            {[
              { name: 'Computer', val: '2.5kWh', color: 'cyan' },
              { name: 'Iron', val: '0.3kWh', color: 'orange' },
              { name: 'Oven', val: '1.5kWh', color: 'purple' },
              { name: 'Charger', val: '0.7kWh', color: 'emerald' },
              { name: 'Other', val: '1.8kWh', color: 'yellow' },
            ].map(device => (
              <div key={device.name} className="flex items-center justify-between p-3 bg-slate-600/30 rounded-lg hover:bg-slate-600/50 transition-colors">
                <div className="flex items-center gap-3">
                  {device.name === 'Computer' && <ComputerIcon sx={{ fontSize: 20 }} />}
                  {device.name === 'Iron' && <LocalFireDepartmentIcon sx={{ fontSize: 20 }} />}
                  {device.name === 'Oven' && <ThermostatIcon sx={{ fontSize: 20 }} />}
                  {device.name === 'Charger' && <PowerIcon sx={{ fontSize: 20 }} />}
                  {device.name === 'Other' && <AutoAwesomeIcon sx={{ fontSize: 20 }} />}
                  <span className="text-sm font-medium text-white">{device.name}</span>
                </div>
                <span className={`text-sm font-semibold text-${device.color}-400`}>{device.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Energy Usage Graph */}
        <div className="col-span-2 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white">Energy Usage</h2>
            <select className="px-4 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500">
              <option>Hourly</option>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>

          {/* Graph */}
          <div className="flex">
            <div className="flex flex-col justify-between items-end pr-3" style={{ width: '40px', height: '200px' }}>
              <span className="text-xs text-slate-500">8</span>
              <span className="text-xs text-slate-500">6</span>
              <span className="text-xs text-slate-500">4</span>
              <span className="text-xs text-slate-500">2</span>
              <span className="text-xs text-slate-500">0</span>
            </div>

            <svg viewBox="0 0 600 200" className="w-full" style={{ height: '200px' }}>
              <line x1="0" y1="0" x2="0" y2="190" stroke="#475569" strokeWidth="1.5" />
              <line x1="0" y1="190" x2="600" y2="190" stroke="#475569" strokeWidth="1.5" />
              <line x1="0" y1="38" x2="600" y2="38" stroke="#334155" strokeWidth="1" opacity="0.3" strokeDasharray="4,4" />
              <line x1="0" y1="76" x2="600" y2="76" stroke="#334155" strokeWidth="1" opacity="0.3" strokeDasharray="4,4" />
              <line x1="0" y1="114" x2="600" y2="114" stroke="#334155" strokeWidth="1" opacity="0.3" strokeDasharray="4,4" />
              <line x1="0" y1="152" x2="600" y2="152" stroke="#334155" strokeWidth="1" opacity="0.3" strokeDasharray="4,4" />
              
              <defs>
                <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points="20,100 60,130 100,80 140,120 180,90 220,140 260,75 300,115 340,95 380,135 420,85 460,125 500,105 540,145 580,95" fill="url(#chartGrad)" stroke="none" />
              <polyline points="20,100 60,130 100,80 140,120 180,90 220,140 260,75 300,115 340,95 380,135 420,85 460,125 500,105 540,145 580,95" fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Time Labels */}
          <div className="flex justify-between text-xs text-slate-500 mt-3" style={{ paddingLeft: '40px' }}>
            <span>09:42 PM</span>
            <span>09:42 PM</span>
            <span>09:42 PM</span>
            <span>09:42 PM</span>
            <span>09:43 PM</span>
            <span>09:44 PM</span>
            <span>09:46 PM</span>
            <span>09:48 PM</span>
            <span>09:51 PM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadBillsContent({ uploadedBills }: { uploadedBills: Bill[] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [expandedBill, setExpandedBill] = useState<number | null>(null);

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
      <p className="text-slate-400 text-sm mb-8">View bills analyzed through the AI Chat. Upload bills directly to the chatbot for instant extraction and analysis.</p>

      {/* Uploaded Bills */}
      <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-slate-600/50 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-lg font-semibold text-white mb-1">OCR Extraction Results</h2>
        <p className="text-sm text-slate-300 mb-6">Processed bills with extracted data and confidence scores</p>

        <div className="space-y-4">
          {uploadedBills.map(bill => (
            <div key={bill.id} className="border border-slate-600/50 rounded-2xl overflow-hidden transition-all duration-300 bg-slate-700/20 hover:shadow-lg hover:shadow-cyan-500/10">
              {/* Header */}
              <button
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

                  {/* Overall OCR Confidence */}
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

                  {/* Quick Preview */}
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

                <span className={`text-2xl text-slate-400 transition-transform duration-300 ml-4 flex-shrink-0 ${
                  expandedBill === bill.id ? 'rotate-180' : ''
                }`}>
                  ▼
                </span>
              </button>

              {/* Expanded Details */}
              {expandedBill === bill.id && (
                <div className="border-t border-slate-600/50 p-6 space-y-6 bg-slate-800/30">
                  {/* Account Details */}
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

                  {/* Billing Period */}
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

                  {/* Consumption Details */}
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

                  {/* Charges Breakdown */}
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

                  {/* Action Buttons */}
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

function AnomalyDetectionContent() {
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const activeAlerts = [
    {
      alert_id: 'alert_001',
      device_id: 'meter_manila_001',
      timestamp: '2026-05-17T14:30:00Z',
      alert_type: 'HIGH_USAGE_ANOMALY',
      expected_wattage_range: '100-250',
      actual_wattage: 450.5,
      message: 'Warning: Your current usage is 80% higher than your historical average for this time of day. Check appliances to avoid bill shock.',
      recommendation: 'Check if any high-power appliances (AC, water heater, microwave) are running simultaneously. Consider staggering usage times.'
    },
    {
      alert_id: 'alert_002',
      device_id: 'meter_manila_002',
      timestamp: '2026-05-17T12:15:00Z',
      alert_type: 'UNUSUAL_PATTERN',
      expected_wattage_range: '50-150',
      actual_wattage: 280.0,
      message: 'Unusual consumption pattern detected. This pattern differs significantly from your normal behavior.',
      recommendation: 'Your device is consuming power at an unusual time. Verify if all devices are functioning correctly.'
    },
    {
      alert_id: 'alert_003',
      device_id: 'meter_manila_001',
      timestamp: '2026-05-17T08:45:00Z',
      alert_type: 'DEVICE_MALFUNCTION',
      expected_wattage_range: '0-50',
      actual_wattage: 200.0,
      message: 'Device malfunction detected. A device may be drawing more power than expected when idle.',
      recommendation: 'Inspect the device for signs of malfunction. Consider replacing or servicing the equipment.'
    }
  ];

  const resolvedAlerts = [
    {
      alert_id: 'alert_past_001',
      device_id: 'meter_manila_001',
      timestamp: '2026-05-16T18:00:00Z',
      alert_type: 'HIGH_USAGE_ANOMALY',
      expected_wattage_range: '100-250',
      actual_wattage: 420.0,
      message: 'High usage detected.',
      recommendation: 'Reduced consumption by turning off unnecessary appliances.',
      resolved_at: '2026-05-16T20:30:00Z'
    },
    {
      alert_id: 'alert_past_002',
      device_id: 'meter_manila_002',
      timestamp: '2026-05-15T10:00:00Z',
      alert_type: 'BILLING_DISCREPANCY',
      expected_wattage_range: '50-150',
      actual_wattage: 180.0,
      message: 'Billing discrepancy detected.',
      recommendation: 'Meter reading verified. No action needed.',
      resolved_at: '2026-05-15T14:00:00Z'
    }
  ];

  const getAlertColor = (type: string) => {
    switch(type) {
      case 'HIGH_USAGE_ANOMALY':
        return 'from-red-500/20 to-orange-500/20 border-red-500/50 text-red-200';
      case 'UNUSUAL_PATTERN':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50 text-yellow-200';
      case 'DEVICE_MALFUNCTION':
        return 'from-red-600/20 to-red-500/20 border-red-600/50 text-red-200';
      case 'BILLING_DISCREPANCY':
        return 'from-orange-500/20 to-yellow-500/20 border-orange-500/50 text-orange-200';
      default:
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/50 text-slate-200';
    }
  };

  const AlertCard = ({ alert, isResolved = false }: { alert: any; isResolved?: boolean }) => {
    const isExpanded = selectedAlert === alert.alert_id;
    
    return (
      <div
        key={alert.alert_id}
        onClick={() => setSelectedAlert(isExpanded ? null : alert.alert_id)}
        className={`cursor-pointer bg-gradient-to-br ${
          isResolved
            ? 'from-emerald-500/15 to-green-500/15 border-emerald-500/40 hover:border-emerald-500/70'
            : getAlertColor(alert.alert_type)
        } rounded-xl p-6 border transition-all duration-300 shadow-lg ${
          isExpanded ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''
        } ${isResolved ? 'ring-emerald-500' : 'ring-red-500'} hover:shadow-xl`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-white text-lg">{alert.alert_id}</h3>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  isResolved
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-red-500/30 text-red-300 border border-red-500/50'
                }`}>
                  {isResolved ? 'Resolved' : 'Active'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-300 mb-2">{alert.alert_type.replace(/_/g, ' ')}</p>
              <p className="text-sm text-slate-200">{alert.message}</p>
            </div>
          </div>
          <span className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">Device ID</p>
            <p className="font-mono text-white">{alert.device_id}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Expected Range</p>
            <p className="font-mono text-white">{alert.expected_wattage_range}W</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Actual Wattage</p>
            <p className="font-mono font-bold text-white text-lg">{alert.actual_wattage}W</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 mb-4">
          Detected: {new Date(alert.timestamp).toLocaleString()}
          {isResolved && alert.resolved_at && (
            <> • Resolved: {new Date(alert.resolved_at).toLocaleString()}</>
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-slate-500/30 pt-4 mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                Recommendation
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {alert.recommendation}
              </p>
            </div>
            {!isResolved && (
              <div className="flex gap-3">
                <button className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-all duration-200">
                  Mark as Resolved
                </button>
                <button className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg font-medium transition-all duration-200">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold text-white mb-2">Anomaly Detection</h1>
        <p className="text-slate-400 text-sm">Active alerts in red, resolved alerts in green with recommendations</p>
      </div>

      {/* Active Alerts */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">Active Alerts ({activeAlerts.length})</h2>
        </div>
        <div className="space-y-4">
          {activeAlerts.length > 0 ? (
            activeAlerts.map(alert => <AlertCard key={alert.alert_id} alert={alert} isResolved={false} />)
          ) : (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-8 text-center">
              <p className="text-emerald-300 font-semibold mb-2">All Clear!</p>
              <p className="text-slate-400 text-sm">No active anomalies detected. Your energy consumption is normal.</p>
            </div>
          )}
        </div>
      </div>

      {/* Resolved Alerts */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">Resolved Alerts ({resolvedAlerts.length})</h2>
        </div>
        <div className="space-y-4">
          {resolvedAlerts.length > 0 ? (
            resolvedAlerts.map(alert => <AlertCard key={alert.alert_id} alert={alert} isResolved={true} />)
          ) : (
            <div className="bg-slate-700/40 border border-slate-600/50 rounded-xl p-8 text-center">
              <p className="text-slate-300 font-semibold mb-2">No history</p>
              <p className="text-slate-400 text-sm">You haven't resolved any alerts yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsContent() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
      <p className="text-slate-400 text-sm mb-8">Manage your account and preferences</p>

      <div className="max-w-2xl space-y-3">
        {/* Account Settings */}
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            onClick={() => setExpandedSection(expandedSection === 'account' ? null : 'account')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AccountCircleIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              <div className="text-left">
                <h2 className="font-semibold text-white">Account Settings</h2>
                <p className="text-sm text-slate-400">Manage your account preferences and profile</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'account' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'account' && (
            <div className="px-6 py-4 border-t border-slate-600/50 space-y-4 bg-slate-800/20">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Profile Information</label>
                <p className="text-sm text-slate-400">Update your personal details</p>
              </div>
              <button className="text-right text-cyan-300 font-medium text-sm hover:text-cyan-200 transition-colors">Edit</button>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            onClick={() => setExpandedSection(expandedSection === 'notifications' ? null : 'notifications')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CircleNotificationsIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              <div className="text-left">
                <h2 className="font-semibold text-white">Notifications</h2>
                <p className="text-sm text-slate-400">Configure alert preferences</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'notifications' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'notifications' && (
            <div className="px-6 py-4 border-t border-slate-600/50 space-y-4 bg-slate-800/20">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-cyan-500" />
                <span className="text-sm text-white">Email alerts for anomalies</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-cyan-500" />
                <span className="text-sm text-white">Weekly consumption report</span>
              </label>
              <button className="text-right text-cyan-300 font-medium text-sm hover:text-cyan-200 transition-colors">Manage</button>
            </div>
          )}
        </div>

        {/* Security */}
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            onClick={() => setExpandedSection(expandedSection === 'security' ? null : 'security')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <SecurityIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              <div className="text-left">
                <h2 className="font-semibold text-white">Security</h2>
                <p className="text-sm text-slate-400">Password and authentication</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'security' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'security' && (
            <div className="px-6 py-4 border-t border-slate-600/50 space-y-3 bg-slate-800/20">
              <button className="w-full text-left p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors duration-200 border border-slate-600/30 hover:border-slate-500/50 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Change Password</span>
                <span className="text-slate-400">→</span>
              </button>
              <button className="w-full text-left p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors duration-200 border border-slate-600/30 hover:border-slate-500/50 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Two-Factor Authentication</span>
                <span className="text-xs text-red-300 font-medium">Disabled</span>
              </button>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            onClick={() => setExpandedSection(expandedSection === 'data' ? null : 'data')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FolderIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              <div className="text-left">
                <h2 className="font-semibold text-white">Data Management</h2>
                <p className="text-sm text-slate-400">Export or delete your data</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'data' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'data' && (
            <div className="px-6 py-4 border-t border-slate-600/50 space-y-3 bg-slate-800/20">
              <button className="w-full text-left p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors duration-200 border border-slate-600/30 hover:border-slate-500/50 text-sm font-medium text-white">Export My Data</button>
              <button className="w-full text-left p-3 bg-red-500/15 rounded-lg hover:bg-red-500/25 transition-colors duration-200 text-sm font-medium text-red-300 border border-red-500/30 hover:border-red-500/50">Delete All Data</button>
            </div>
          )}
        </div>

        {/* IoT Device Settings */}
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            onClick={() => setExpandedSection(expandedSection === 'iot' ? null : 'iot')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <DeviceHubIcon sx={{ fontSize: 28, color: '#ffffff' }} />
              <div className="text-left">
                <h2 className="font-semibold text-white">IoT Device Settings</h2>
                <p className="text-sm text-slate-400">Manage connected hardware devices</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'iot' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'iot' && (
            <div className="px-6 py-4 border-t border-slate-600/50 bg-slate-800/20">
              <p className="text-sm text-slate-300 mb-4">No IoT devices connected. Connect your energy monitoring hardware to start tracking real-time data.</p>
              <button className="w-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white py-2 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50">+ Add Device</button>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="bg-gradient-to-br from-red-500/15 to-red-500/5 backdrop-blur-sm rounded-2xl border border-red-500/30 p-6 shadow-xl hover:shadow-2xl hover:border-red-500/50 transition-all duration-300">
          <h2 className="font-semibold text-red-200 mb-2">Logout</h2>
          <p className="text-sm text-red-100/70 mb-4">Sign out of your Bantay Dagitab account</p>
          <button className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-red-600/30 hover:shadow-red-600/50">
            <LogoutIcon sx={{ fontSize: 20 }} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ onClose, setUploadedBills, uploadedBills }: { onClose: () => void; setUploadedBills: React.Dispatch<React.SetStateAction<Bill[]>>; uploadedBills: Bill[] }) {
  const [messages, setMessages] = useState<Array<{ id: number; role: 'user' | 'assistant'; content: string; files?: File[] }>>([
    { id: 1, role: 'assistant', content: 'Hello! I\'m your AI assistant. I can help you analyze your energy consumption, detect anomalies, and answer questions about your bills. You can upload your MERALCO bills here and I\'ll extract and summarize the data for you. The information will be saved to your Bills tab for future reference. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageIcon sx={{ fontSize: 16 }} />;
    if (type === 'application/pdf') return <DescriptionIcon sx={{ fontSize: 16 }} />;
    if (type.includes('word') || type.includes('document')) return <ArticleIcon sx={{ fontSize: 16 }} />;
    if (type.includes('sheet') || type.includes('excel')) return <TableChartIcon sx={{ fontSize: 16 }} />;
    return <AttachFileIcon sx={{ fontSize: 16 }} />;
  };

  const handleSendMessage = async (e: React.FormEvent, customMessage?: string) => {
    e.preventDefault();
    const messageContent = customMessage || input;
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    // Add user message
    const userMessage = { 
      id: messages.length + 1, 
      role: 'user' as const, 
      content: messageContent,
      files: selectedFiles.length > 0 ? selectedFiles : undefined
    };
    setMessages([...messages, userMessage]);
    setInput('');
    
    // Check if files are being uploaded (likely bills)
    const billFiles = selectedFiles.filter(f => 
      f.type.startsWith('image/') || 
      f.type === 'application/pdf' || 
      f.name.toLowerCase().includes('bill') ||
      f.name.toLowerCase().includes('meralco')
    );
    
    setSelectedFiles([]);
    setIsLoading(true);

    // Simulate AI response and bill processing
    setTimeout(() => {
      let responseContent = 'I understand. I\'m analyzing your data.';
      
      if (billFiles.length > 0) {
        const fileNames = billFiles.map(f => f.name).join(', ');
        
        // Generate extracted bill data
        billFiles.forEach((file, fileIdx) => {
          const newBill: Bill = {
            id: uploadedBills.length + fileIdx + 1,
            name: file.name.replace(/\.[^/.]+$/, '') || 'MERALCO Bill',
            status: 'completed',
            uploadDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            ocrConfidence: 88 + Math.random() * 10, // Random confidence between 88-98%
            extractedData: {
              accountDetails: {
                accountNumber: '123-456-7890',
                customerName: 'Juan Dela Cruz',
                serviceAddress: '123 Main Street, Manila, 1000',
                meterNumber: 'M-2026-001',
                confidence: 95
              },
              billingPeriod: {
                startDate: 'Apr 15, 2026',
                endDate: 'May 14, 2026',
                daysInPeriod: 30,
                readingDate: 'May 14, 2026',
                confidence: 98
              },
              consumption: {
                previousReading: 12641,
                currentReading: 12832,
                totalkWh: 191,
                unit: 'kWh',
                confidence: 97
              },
              charges: [
                { description: 'Generation', amount: 1140.50, confidence: 94 },
                { description: 'Transmission', amount: 185.75, confidence: 92 },
                { description: 'Distribution', amount: 125.30, confidence: 91 },
                { description: 'System Loss', amount: 45.50, confidence: 89 },
                { description: 'Metering', amount: 15.00, confidence: 95 },
              ],
              totalAmount: 1482.05,
              dueDate: 'Jun 5, 2026',
              confidence: 96
            }
          };
          
          // Add bill to Bills tab
          setUploadedBills(prev => [...prev, newBill]);
        });
        
        responseContent = `I've successfully analyzed your bill(s): ${fileNames}\n\nAnalysis Summary:\n• Consumption: 191 kWh\n• Previous Reading: 12,641\n• Current Reading: 12,832\n• Total Amount Due: ₱1,482.05\n• Due Date: Jun 5, 2026\n\nThe extracted data has been saved to your Bills tab. You can review all details there.`;
      } else {
        responseContent = 'I understand. I\'m analyzing your energy data. This is a placeholder response. In a real implementation, this would connect to your AI backend service to provide intelligent insights about your consumption patterns.';
      }
      
      const botMessage = { 
        id: messages.length + 2, 
        role: 'assistant' as const, 
        content: responseContent
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <>
      <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
        <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-xs">
              <div className={`px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white rounded-br-none'
                  : 'bg-slate-700/50 text-slate-100 border border-slate-600/50 rounded-bl-none'
              }`}>
                <p className="text-sm">{message.content}</p>
              </div>
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/30 rounded-lg border border-slate-600/50 text-xs text-slate-300">
                      <span>{getFileIcon(file)}</span>
                      <span className="truncate">{file.name}</span>
                      <span className="text-slate-500">({(file.size / 1024).toFixed(1)}KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/50 text-slate-100 border border-slate-600/50 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/50 bg-slate-800/50 p-4 space-y-3">
        {/* Suggestion Buttons */}
        {messages.length <= 1 && (
          <div className="space-y-2">
            <button
              onClick={(e) => handleSendMessage(e as any, 'Analyze my energy consumption patterns and give recommendations')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Analyze my consumption</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
            <button
              onClick={(e) => handleSendMessage(e as any, 'Analyze my MERALCO bill and explain the charges')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Analyze my MERALCO bill</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
            <button
              onClick={(e) => handleSendMessage(e as any, 'What are the best ways to reduce my energy costs?')}
              className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-300 hover:text-slate-100 text-sm rounded-lg transition-all flex items-center justify-between group"
            >
              <span>Energy-saving tips</span>
              <span className="text-slate-500 group-hover:text-slate-400 transition-colors">↓</span>
            </button>
          </div>
        )}

        {/* File Display */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 pb-2 border-b border-slate-700/50">
            <p className="text-xs text-slate-400">Attached files ({selectedFiles.length}):</p>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600/50 text-xs text-slate-300 hover:border-cyan-500/50 transition-all">
                  <span>{getFileIcon(file)}</span>
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700/50 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-10 h-10 flex-shrink-0 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 hover:border-purple-500/50 text-slate-300 hover:text-purple-300 rounded-lg transition-all"
            title="Attach files"
          >
            +
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 disabled:from-slate-600 disabled:to-slate-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:shadow-none flex-shrink-0"
          >
            Send
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
        />
      </form>
    </>
  );
}
