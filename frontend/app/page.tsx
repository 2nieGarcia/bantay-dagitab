'use client';

import React, { useState } from 'react';

type TabType = 'dashboard' | 'upload-bills' | 'anomaly' | 'settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <DashboardContent />;
      case 'upload-bills':
        return <UploadBillsContent />;
      case 'anomaly':
        return <AnomalyDetectionContent />;
      case 'settings':
        return <SettingsContent />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <aside className="w-64 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm border-r border-slate-700/50 p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-sky-500 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-xl shadow-cyan-500/20">
            B
          </div>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">Bantay Dagitab</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'text-cyan-300 bg-slate-700/40 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20 border border-transparent'
            }`}>
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('upload-bills')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'upload-bills'
                ? 'text-cyan-300 bg-slate-700/40 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20 border border-transparent'
            }`}>
            Upload Bills
          </button>
          <button 
            onClick={() => setActiveTab('anomaly')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'anomaly'
                ? 'text-cyan-300 bg-slate-700/40 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20 border border-transparent'
            }`}>
            Anomaly Detection
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'settings'
                ? 'text-cyan-300 bg-slate-700/40 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20 border border-transparent'
            }`}>
            Settings
          </button>
        </nav>

        <div className="p-5 bg-gradient-to-br from-cyan-500/15 to-sky-500/15 rounded-xl border border-cyan-500/25 hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300">
          <p className="text-sm font-semibold text-cyan-100 mb-2">Connect IoT Device</p>
          <p className="text-xs text-slate-400 mb-4">Link your energy monitoring hardware</p>
          <button className="w-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white text-sm font-semibold py-2.5 rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-200">
            Setup Device
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {renderContent()}
      </main>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">Monitor your energy consumption in real-time</p>
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
              { name: 'Computer', emoji: '💻', val: '2.5kWh', color: 'cyan' },
              { name: 'Iron', emoji: '🔥', val: '0.3kWh', color: 'orange' },
              { name: 'Oven', emoji: '🌡️', val: '1.5kWh', color: 'purple' },
              { name: 'Charger', emoji: '🔌', val: '0.7kWh', color: 'emerald' },
              { name: 'Other', emoji: '✨', val: '1.8kWh', color: 'yellow' },
            ].map(device => (
              <div key={device.name} className="flex items-center justify-between p-3 bg-slate-600/30 rounded-lg hover:bg-slate-600/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{device.emoji}</span>
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

function UploadBillsContent() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedBills] = useState([
    { id: 1, name: 'MERALCO Bill', status: 'completed', ocr: '86.2%', period: 'Mar 15 - Apr 14, 2026', consumption: '191 kWh', amount: '₱1482.05', dueDate: 'May 5, 2026', account: '***-***-3530' },
  ]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Upload Bills</h1>
      <p className="text-slate-400 text-sm mb-8">Upload and digitize your MERALCO electricity bills</p>

      {/* Upload Section */}
      <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-8 mb-8 shadow-xl border border-slate-600/50 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-lg font-semibold text-white mb-2">Upload MERALCO Bill</h2>
        <p className="text-sm text-slate-300 mb-6">Drag and drop your electricity bill or click to upload. OCR will automatically extract the data.</p>

        <div 
          onDragOver={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-2xl p-16 transition-all text-center ${
            isDragging 
              ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/20 to-sky-500/20 shadow-lg shadow-cyan-500/25' 
              : 'border-slate-600/50 bg-slate-700/30 hover:border-cyan-400/60 hover:bg-slate-700/50'
          }`}>
          <div className="flex flex-col items-center gap-4">
            <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div>
              <p className="text-white font-medium mb-1">Drag and drop your bill</p>
              <p className="text-slate-400 text-sm">or</p>
            </div>
            <button className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50">
              <span>📁</span>
              Choose File
            </button>
          </div>
        </div>
      </div>

      {/* Uploaded Bills */}
      <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-slate-600/50 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-lg font-semibold text-white mb-1">Uploaded Bills</h2>
        <p className="text-sm text-slate-300 mb-6">History of processed electricity bills</p>

        <div className="space-y-4">
          {uploadedBills.map(bill => (
            <div key={bill.id} className="border border-slate-600/50 rounded-xl p-6 hover:border-cyan-400/60 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 bg-slate-700/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 text-lg">✓</span>
                      <span className="font-semibold text-white">{bill.name}</span>
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/40 shadow-lg shadow-emerald-500/10">completed</span>
                      <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs font-semibold rounded-full border border-cyan-500/40 shadow-lg shadow-cyan-500/10">OCR {bill.ocr}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Account: {bill.account}</p>
                </div>
                <button className="text-slate-400 hover:text-slate-300">⋯</button>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-slate-400 mb-1">📅 Period</p>
                  <p className="text-sm font-medium text-white">{bill.period}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">⚡ Consumption</p>
                  <p className="text-sm font-medium text-white">{bill.consumption}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">💰 Total Amount</p>
                  <p className="text-sm font-medium text-white">{bill.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">📆 Due Date</p>
                  <p className="text-sm font-medium text-white">{bill.dueDate}</p>
                </div>
              </div>

              <button className="text-cyan-300 text-sm font-medium hover:text-cyan-200 mt-4 flex items-center gap-1 transition-colors">
                👁️ Show Bill Explanation
                <span>v</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnomalyDetectionContent() {
  const [activeAlerts] = useState([
    { id: 1, type: 'High Consumption', time: 'Apr 25, 08:08 PM', minutes: '(1 minute ago)', severity: 'high', desc: 'Abnormally high power consumption detected at 4.8 kW, 81% above your typical usage during this time.' },
    { id: 2, type: 'Cost Surge', time: 'Apr 25, 08:31 PM', minutes: '(1 day ago)', severity: 'high', desc: 'Dry cost projection exceeds P203 within a 1.02% higher than your 20-day average of ₱203-day.' },
  ]);

  const [resolved] = useState([
    { id: 1, type: 'Unusual Pattern', time: 'Apr 22, 01:11 PM', minutes: '(2 hours ago)', desc: 'Consumption pattern differs from your usual electricity usage. Usage started 2 hours earlier than normal.' },
    { id: 2, type: 'Voltage Spike', time: 'Apr 21, 01:31 PM', minutes: '(2 hours ago)', desc: 'Line voltage fluctuation detected (250V peak). May affect sensitive electronic equipment.' },
    { id: 3, type: 'High Consumption', time: 'Apr 22, 01:11 AM', minutes: '(1 day ago)', desc: 'Sight increase in baseline consumption (3.3 kW above normal). May indicate an appliance inefficiency.' },
  ]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Anomaly Detection</h1>
      <p className="text-slate-400 text-sm mb-8">Recent anomaly detections and alerts</p>

      {/* Detection Status */}
      <div className="bg-gradient-to-br from-blue-500/15 to-cyan-500/15 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 mb-8 flex items-start gap-3 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all">
        <span className="text-2xl mt-1">⏱️</span>
        <div>
        <p className="font-semibold text-blue-200 mb-1">Detection Latency: ~3 minutes</p>
        <p className="text-sm text-blue-100">• Anomalies are detected and displayed in real-time to help you prevent billing surprises</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-slate-400 text-sm mb-2">⚠️ Active Alerts</p>
          <p className="text-3xl font-bold text-white">2</p>
          <p className="text-xs text-slate-400 mt-2">Ongoing anomalies</p>
        </div>
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-slate-400 text-sm mb-2">✓ Resolved</p>
          <p className="text-3xl font-bold text-white">3</p>
          <p className="text-xs text-slate-400 mt-2">Last 7 days</p>
        </div>
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-slate-400 text-sm mb-2">📊 Detection Rate</p>
          <p className="text-3xl font-bold text-white">100%</p>
          <p className="text-xs text-slate-400 mt-2">Accuracy in detection</p>
        </div>
      </div>

      {/* Active Anomalies */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Active Anomalies</h2>
        <div className="space-y-3">
          {activeAlerts.map(alert => (
            <div key={alert.id} className={`rounded-xl p-5 border-l-4 ${
              alert.severity === 'high' 
                ? 'bg-gradient-to-r from-red-500/15 to-red-500/5 border-l-red-500 border border-red-500/30 shadow-lg shadow-red-500/10' 
                : 'bg-gradient-to-r from-yellow-500/15 to-yellow-500/5 border-l-yellow-500 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
            } hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className={`font-semibold mb-1 ${alert.severity === 'high' ? 'text-red-200' : 'text-yellow-200'}`}>{alert.type}</h3>
                  <p className={`text-xs ${alert.severity === 'high' ? 'text-red-300/70' : 'text-yellow-300/70'}`}>{alert.time} <span className="opacity-60">{alert.minutes}</span></p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded shadow-lg ${
                  alert.severity === 'high' 
                    ? 'bg-red-600 text-white shadow-red-600/50' 
                    : 'bg-yellow-600 text-white shadow-yellow-600/50'
                }`}>{alert.severity.toUpperCase()}</span>
              </div>
              <p className={`text-sm ${alert.severity === 'high' ? 'text-red-100' : 'text-yellow-100'}`}>{alert.desc}</p>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <span className="font-medium text-slate-300">Recommendation:</span>
                <span className={alert.severity === 'high' ? 'text-red-100' : 'text-yellow-100'}>Check if air conditioning units or water heaters are running simultaneously. Consider staggering usage of high-power appliances.</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolved Anomalies */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Resolved Anomalies</h2>
        <p className="text-sm text-slate-400 mb-4">Historical anomalies from the past week</p>
        <div className="space-y-3">
          {resolved.map(item => (
            <div key={item.id} className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-600/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-300 text-lg">✓</span>
                    <h3 className="font-semibold text-white">{item.type}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{item.time} <span className="opacity-60">{item.minutes}</span></p>
                  <p className="text-sm text-slate-200">{item.desc}</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/40 shadow-lg shadow-emerald-500/10">RESOLVED</span>
              </div>
            </div>
          ))}
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
              <span className="text-2xl">👤</span>
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
              <span className="text-2xl">🔔</span>
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
              <span className="text-2xl">🔒</span>
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
              <span className="text-2xl">💾</span>
              <div className="text-left">
                <h2 className="font-semibold text-white">Data Management</h2>
                <p className="text-sm text-slate-400">Export or delete your data</p>
              </div>
            </div>
            <span className={`transition-transform text-slate-400 duration-300 ${expandedSection === 'data' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {expandedSection === 'data' && (
            <div className="px-6 py-4 border-t border-slate-600/50 space-y-3 bg-slate-800/20">
              <button className="w-full text-left p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors duration-200 border border-slate-600/30 hover:border-slate-500/50 text-sm font-medium text-white">📥 Export My Data</button>
              <button className="w-full text-left p-3 bg-red-500/15 rounded-lg hover:bg-red-500/25 transition-colors duration-200 text-sm font-medium text-red-300 border border-red-500/30 hover:border-red-500/50">🗑️ Delete All Data</button>
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
              <span className="text-2xl">🔌</span>
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
            <span>🚪</span>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
