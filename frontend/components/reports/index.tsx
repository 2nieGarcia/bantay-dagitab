'use client';

import { useState } from 'react';

export default function ReportsContent() {
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
      recommendation: 'Check if any high-power appliances (AC, water heater, microwave) are running simultaneously. Consider staggering usage times.',
    },
    {
      alert_id: 'alert_002',
      device_id: 'meter_manila_002',
      timestamp: '2026-05-17T12:15:00Z',
      alert_type: 'UNUSUAL_PATTERN',
      expected_wattage_range: '50-150',
      actual_wattage: 280.0,
      message: 'Unusual consumption pattern detected. This pattern differs significantly from your normal behavior.',
      recommendation: 'Your device is consuming power at an unusual time. Verify if all devices are functioning correctly.',
    },
    {
      alert_id: 'alert_003',
      device_id: 'meter_manila_001',
      timestamp: '2026-05-17T08:45:00Z',
      alert_type: 'DEVICE_MALFUNCTION',
      expected_wattage_range: '0-50',
      actual_wattage: 200.0,
      message: 'Device malfunction detected. A device may be drawing more power than expected when idle.',
      recommendation: 'Inspect the device for signs of malfunction. Consider replacing or servicing the equipment.',
    },
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
      resolved_at: '2026-05-16T20:30:00Z',
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
      resolved_at: '2026-05-15T14:00:00Z',
    },
  ];

  const getAlertColor = (type: string) => {
    switch (type) {
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
          <span className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
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
          {isResolved && alert.resolved_at && <> • Resolved: {new Date(alert.resolved_at).toLocaleString()}</>}
        </div>

        {isExpanded && (
          <div className="border-t border-slate-500/30 pt-4 mt-4 space-y-4">
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">Recommendation</h4>
              <p className="text-sm text-slate-200 leading-relaxed">{alert.recommendation}</p>
            </div>
            {!isResolved && (
              <div className="flex gap-3">
                <button className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-all duration-200">Mark as Resolved</button>
                <button className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg font-medium transition-all duration-200">Dismiss</button>
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

      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">Resolved Alerts ({resolvedAlerts.length})</h2>
        </div>
        <div className="space-y-4">
          {resolvedAlerts.length > 0 ? (
            resolvedAlerts.map(alert => <AlertCard key={alert.alert_id} alert={alert} isResolved />)
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
