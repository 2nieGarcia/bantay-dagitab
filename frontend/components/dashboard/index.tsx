'use client';

import { keyframes } from '@emotion/react';
import WarningIcon from '@mui/icons-material/Warning';
import ComputerIcon from '@mui/icons-material/Computer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PowerIcon from '@mui/icons-material/Power';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const deviceColorMap: Record<string, string> = {
  cyan: 'text-cyan-400',
  orange: 'text-orange-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
  yellow: 'text-yellow-400',
};

export default function DashboardContent({
  userName,
  userAccount,
}: {
  userName: string;
  userAccount: string;
}) {
  return (
    <div className="p-8">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold text-white mb-2">Welcome back, {userName}</h1>
        <p className="text-slate-400 text-sm">{userAccount}</p>
        <p className="text-slate-500 text-xs mt-4">Energy Monitoring Dashboard</p>
      </div>

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

      <div className="grid grid-cols-4 gap-6" style={{ gridAutoRows: 'auto' }}>
        <div className="col-span-1 row-span-2 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <h2 className="text-lg font-semibold text-white mb-6">Energy Consumption</h2>
          <input type="date" defaultValue="2026-04-22" className="w-full px-4 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-sm text-white mb-6" />

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
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                    item.color === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    <span>{item.trend === 'up' ? '↑' : '↓'}</span>
                    <span>{item.pct}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-sm text-slate-400 mb-3">Total kWh</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">22kWh</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>

        <div className="col-span-1 bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-600/50 hover:border-slate-500/70 hover:shadow-2xl transition-all duration-300">
          <p className="text-sm text-slate-400 mb-3">Price</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">₱1M</p>
          <p className="text-sm text-slate-500 mt-2">This month</p>
        </div>

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
                <span className={`${deviceColorMap[device.color]} text-sm font-semibold`}>{device.val}</span>
              </div>
            ))}
          </div>
        </div>

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
