'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Brand } from '@/components/shared/brand';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

type InjectedReading = {
  id: number;
  device_id: string;
  timestamp: string;
  avg_wattage: number;
  reading_interval_minutes: number;
};

type RecentAnomaly = {
  alert_id: number;
  device_id: string;
  timestamp: string;
  alert_type: string;
  expected_wattage_range: string;
  actual_wattage: number;
  message: string;
};

export default function MlTesterPage() {
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await api.get('/users/profile/');
      return res.data;
    },
  });

  const [deviceId, setDeviceId] = useState('meter_test_001');

  useEffect(() => {
    if (userProfile?.device_id) {
      setDeviceId(userProfile.device_id);
    }
  }, [userProfile]);
  const [avgWattage, setAvgWattage] = useState(3500);
  const [count, setCount] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(15);

  const [injecting, setInjecting] = useState(false);
  const [injectError, setInjectError] = useState('');
  const [injected, setInjected] = useState<InjectedReading[] | null>(null);

  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<RecentAnomaly[] | null>(null);
  const [anomaliesError, setAnomaliesError] = useState('');

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    setInjectError('');
    setInjected(null);
    setInjecting(true);
    try {
      const res = await api.post<InjectedReading[]>('/iot/readings/dev-inject/', {
        device_id: deviceId.trim(),
        avg_wattage: avgWattage,
        count,
        interval_minutes: intervalMinutes,
      });
      setInjected(res.data);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setInjectError(detail || 'Injection failed. Check the device ID and values.');
    } finally {
      setInjecting(false);
    }
  };

  const refreshAnomalies = async () => {
    setAnomaliesError('');
    setAnomaliesLoading(true);
    try {
      const res = await api.get<RecentAnomaly[]>('/analytics/recent-anomalies/');
      setAnomalies(res.data);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAnomaliesError(detail || 'Could not load anomalies.');
    } finally {
      setAnomaliesLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Brand size="md" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
          Developer tools
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight leading-[1.1]">
          ML Tester
        </h1>
        <p className="text-sm text-ink-2 mt-3 leading-relaxed max-w-prose">
          Inject synthetic IoT readings owned by your account, then run the
          inference worker to verify the full Contract A → ML worker →
          Contract C → dashboard pipeline. With <code>count ≥ 3</code> and a
          wattage well above your historical mean, the sustained-3 rule
          (paper §IV.C) should fire.
        </p>

        <div className="mt-10 border border-line rounded-lg bg-surface p-8">
          <h2 className="font-display text-xl text-ink tracking-tight mb-6">
            1. Inject readings
          </h2>
          <form className="space-y-5" onSubmit={handleInject}>
            {injectError && (
              <p className="text-sm text-red-500 leading-relaxed">{injectError}</p>
            )}

            <div>
              <label
                htmlFor="device_id"
                className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
              >
                Device ID
              </label>
              <input
                id="device_id"
                type="text"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder="meter_test_001"
                className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                required
              />
              <p className="text-xs text-ink-3 mt-1.5">
                Any string. Reusing your real ESP32 device_id ties the test to your live history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="avg_wattage"
                  className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
                >
                  Wattage
                </label>
                <input
                  id="avg_wattage"
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={avgWattage}
                  onChange={e => setAvgWattage(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink tabular focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="count"
                  className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
                >
                  Count
                </label>
                <input
                  id="count"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink tabular focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="interval_minutes"
                  className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
                >
                  Interval (min)
                </label>
                <input
                  id="interval_minutes"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={intervalMinutes}
                  onChange={e => setIntervalMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink tabular focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={injecting}
              className="w-full py-3 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors mt-2 disabled:opacity-50"
            >
              {injecting ? 'Injecting...' : `Inject ${count} reading${count === 1 ? '' : 's'}`}
            </button>
          </form>

          {injected && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-sm text-ink-2 mb-3">
                <span className="font-semibold text-ink">{injected.length}</span> reading{injected.length === 1 ? '' : 's'} written to <code>iot_monitoring_iotreading</code>:
              </p>
              <ul className="space-y-1 text-xs tabular text-ink-2">
                {injected.map(r => (
                  <li key={r.id}>
                    id={r.id} · {r.device_id} · {new Date(r.timestamp).toISOString()} · {r.avg_wattage} W
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 border border-line rounded-lg bg-surface p-8">
          <h2 className="font-display text-xl text-ink tracking-tight mb-3">
            2. Run the inference worker
          </h2>
          <p className="text-sm text-ink-2 leading-relaxed mb-4">
            The frontend cannot trigger the worker for you — run it yourself in a shell where <code>DATABASE_URL</code>, <code>BACKEND_API_URL</code>, and <code>SERVICE_ACCOUNT_TOKEN</code> are set:
          </p>
          <pre className="rounded-md bg-page border border-line-strong p-4 text-xs tabular text-ink-2 overflow-x-auto">
{`cd ml
python -m src.inference.run worker --config config/deployment.yaml --log-level INFO`}
          </pre>
          <p className="text-xs text-ink-3 mt-3">
            Expect a log line like <code>Processed N rows, alerts_triggered=K, pushed=K, push_failures=0, cursor=…</code>.
          </p>
        </div>

        <div className="mt-8 border border-line rounded-lg bg-surface p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-ink tracking-tight">
              3. Check your alerts
            </h2>
            <button
              type="button"
              onClick={refreshAnomalies}
              disabled={anomaliesLoading}
              className="text-sm font-medium text-accent hover:text-accent-strong transition-colors disabled:opacity-50"
            >
              {anomaliesLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {anomaliesError && (
            <p className="text-sm text-red-500 leading-relaxed mb-3">{anomaliesError}</p>
          )}
          {!anomaliesError && anomalies === null && (
            <p className="text-sm text-ink-3">
              Click <span className="font-medium text-ink-2">Refresh</span> after the worker run to fetch your latest anomalies from <code>/api/analytics/recent-anomalies/</code>.
            </p>
          )}
          {anomalies && anomalies.length === 0 && (
            <p className="text-sm text-ink-3">
              No anomalies yet. The worker may not have run, the readings may not be anomalous enough to cross threshold, or the sustained-3 rule isn&apos;t satisfied.
            </p>
          )}
          {anomalies && anomalies.length > 0 && (
            <ul className="space-y-3">
              {anomalies.map(a => (
                <li key={a.alert_id} className="border border-line-strong rounded-md p-4 bg-page">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs uppercase tracking-wider font-semibold text-accent">{a.alert_type}</span>
                    <span className="text-xs tabular text-ink-3">{new Date(a.timestamp).toISOString()}</span>
                  </div>
                  <p className="text-sm text-ink mt-2">{a.message}</p>
                  <p className="text-xs tabular text-ink-2 mt-2">
                    device <span className="text-ink">{a.device_id}</span> · expected {a.expected_wattage_range} W · actual <span className="text-ink">{a.actual_wattage}</span> W
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
