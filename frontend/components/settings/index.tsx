'use client';

import { useState } from 'react';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CircleNotificationsIcon from '@mui/icons-material/CircleNotifications';
import SecurityIcon from '@mui/icons-material/Security';
import FolderIcon from '@mui/icons-material/Folder';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import LogoutIcon from '@mui/icons-material/Logout';

export default function SettingsContent() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
      <p className="text-slate-400 text-sm mb-8">Manage your account and preferences</p>

      <div className="max-w-2xl space-y-3">
        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            type="button"
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
            type="button"
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

        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            type="button"
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

        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            type="button"
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

        <div className="bg-gradient-to-br from-slate-700/40 to-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 mb-3 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-500/70 transition-all duration-300">
          <button
            type="button"
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
