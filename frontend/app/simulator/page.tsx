'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BoltIcon from '@mui/icons-material/Bolt';
import { Brand } from '@/components/shared/brand';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

type ReadingApi = {
  id: number;
  device_id: string;
  user_account_id: number;
  timestamp: string;
  avg_wattage: number;
  reading_interval_minutes: number;
};

// Realistic household baseline:
//   - Idle floor ~250 W (fridge cycle, standby loads)
//   - Comfortable peak ~900 W (lights + TV + small appliance)
//   - Brief microwave-style transients allowed up to ~1500 W
// The random walk biases toward 'baseline' but allows ±150 W per step plus
// a 12% chance of a "burst" event that adds 400-700 W for one tick.
function nextReading(prev: number): number {
  const baseline = 450;
  const meanReversion = (baseline - prev) * 0.08;
  const stepNoise = (Math.random() - 0.5) * 300;
  const burst = Math.random() < 0.12 ? 400 + Math.random() * 300 : 0;
  const next = prev + meanReversion + stepNoise + burst;
  return Math.max(150, Math.min(1600, next));
}

const SPARK_W = 800;
const SPARK_H = 90;

function Sparkline({ readings }: { readings: ReadingApi[] }) {
  if (readings.length < 2) {
    return (
      <div className="h-24 w-full rounded-md border border-dashed border-line-strong flex items-center justify-center">
        <p className="text-xs text-ink-3">
          {readings.length === 0
            ? 'Start the simulator to begin pumping readings.'
            : 'Building up history…'}
        </p>
      </div>
    );
  }
  const values = readings.map(r => r.avg_wattage);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, 50);
  const pts = readings
    .map((r, i) => {
      const x = (i / (readings.length - 1)) * SPARK_W;
      const y = SPARK_H - ((r.avg_wattage - minV) / span) * (SPARK_H - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY = SPARK_H - ((values[values.length - 1] - minV) / span) * (SPARK_H - 10) - 5;
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="simSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-strong)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-accent-strong)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${SPARK_H} ${pts} ${SPARK_W},${SPARK_H}`} fill="url(#simSparkFill)" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-accent-strong)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={SPARK_W} cy={lastY} r={3.5} fill="var(--color-accent-strong)" />
    </svg>
  );
}

export default function SimulatorPage() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [tickMs, setTickMs] = useState(2_000);
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await api.get('/users/profile/');
      return res.data;
    },
  });

  const [deviceId, setDeviceId] = useState('demo_meter');

  useEffect(() => {
    if (userProfile?.device_id) {
      setDeviceId(userProfile.device_id);
    }
  }, [userProfile]);
  const lastValueRef = useRef<number>(450);

  // Live sparkline reads from the last 30 minutes so the chart starts
  // visibly populating as soon as the user clicks Start.
  const { data: recentReadings = [] } = useQuery<ReadingApi[]>({
    queryKey: ['simulator-recent'],
    queryFn: async () => {
      const res = await api.get<ReadingApi[]>('/iot/readings/recent/', {
        params: { minutes: 30 },
      });
      return res.data;
    },
    refetchInterval: 1_500,
  });

  const injectMutation = useMutation({
    mutationFn: async ({ wattage, count }: { wattage: number; count: number }) => {
      await api.post('/iot/readings/dev-inject/', {
        device_id: deviceId.trim() || 'demo_meter',
        avg_wattage: wattage,
        count,
        interval_minutes: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulator-recent'] });
      queryClient.invalidateQueries({ queryKey: ['recentReadings'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies-active'] });
    },
  });

  type RunMlSummary = {
    processed?: number;
    alerts_triggered?: number;
    pushed?: number;
    push_failures?: number;
    cursor?: number;
    skipped_no_readings?: boolean;
    model_loaded?: boolean;
    predictor_mode?: string;
    detail?: string;
  };
  const [lastRun, setLastRun] = useState<RunMlSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runMlMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<RunMlSummary>('/iot/run-ml/');
      return res.data;
    },
    onSuccess: data => {
      setLastRun(data);
      setRunError(null);
      queryClient.invalidateQueries({ queryKey: ['simulator-recent'] });
      queryClient.invalidateQueries({ queryKey: ['recentReadings'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies-active'] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRunError(detail || 'Could not run ML inference. Is the ml service up?');
      setLastRun(null);
    },
  });

  // Seed the random walk from the most recent server reading on each new
  // simulator session so the first generated point doesn't snap back to 450.
  useEffect(() => {
    if (recentReadings.length === 0) return;
    lastValueRef.current = recentReadings[recentReadings.length - 1].avg_wattage;
  }, [recentReadings]);

  useEffect(() => {
    if (!running) return;
    const handle = setInterval(() => {
      const next = nextReading(lastValueRef.current);
      lastValueRef.current = next;
      injectMutation.mutate({ wattage: Math.round(next), count: 1 });
    }, tickMs);
    return () => clearInterval(handle);
  }, [running, tickMs, injectMutation]);

  const latest = recentReadings.length > 0 ? recentReadings[recentReadings.length - 1] : null;

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

      <div className="flex-1 mx-auto w-full max-w-4xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
          Demo / IoT simulator
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight leading-[1.1]">
          IoT simulator
        </h1>
        <p className="text-sm text-ink-2 mt-3 leading-relaxed max-w-prose">
          Start the simulator and it will pump synthetic readings shaped like
          a real household — mean-reverting random walk around a 450 W
          baseline, occasional burst events up to ~1500 W. Hit{' '}
          <span className="font-semibold text-signal-strong">Spike + run inference</span>{' '}
          to force a sustained-3 anomaly and immediately run the worker
          against it.
        </p>

        <div className="mt-10 border border-line rounded-lg bg-surface p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-ink-2">
                Live reading &middot; last 30 min
              </p>
              {latest ? (
                <p className="text-sm text-ink-3 mt-0.5 tabular">
                  {latest.device_id} &middot;{' '}
                  {new Date(latest.timestamp).toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              ) : (
                <p className="text-sm text-ink-3 mt-0.5">No readings yet</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {latest ? (
                <>
                  <p className="font-readout text-4xl text-ink leading-none tabular">
                    {Math.round(latest.avg_wattage)}
                    <span className="text-base text-ink-3 font-sans font-normal ml-1">W</span>
                  </p>
                  <p className="text-xs text-ink-3 mt-1 tabular">
                    {recentReadings.length} sample{recentReadings.length === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p className="font-readout text-4xl text-ink-3 leading-none">—</p>
              )}
            </div>
          </div>

          <Sparkline readings={recentReadings} />
        </div>

        <div className="mt-6 border border-line rounded-lg bg-surface p-6">
          <h2 className="font-display text-xl text-ink tracking-tight mb-5">
            Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <label
                htmlFor="sim_device_id"
                className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
              >
                Device ID
              </label>
              <input
                id="sim_device_id"
                type="text"
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                placeholder="demo_meter"
                className="w-full px-3 py-2.5 rounded-md border border-line-strong bg-page text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
              <p className="text-xs text-ink-3 mt-1.5">
                Reusing your ESP32 device_id ties simulated readings to that meter's history.
              </p>
            </div>

            <div>
              <label
                htmlFor="sim_tick"
                className="block text-xs uppercase tracking-wider font-medium text-ink-2 mb-2"
              >
                Tick interval &middot; <span className="tabular">{tickMs / 1000}s</span>
              </label>
              <input
                id="sim_tick"
                type="range"
                min={1000}
                max={10000}
                step={500}
                value={tickMs}
                onChange={e => setTickMs(Number(e.target.value))}
                className="w-full accent-(--color-accent)"
              />
              <p className="text-xs text-ink-3 mt-1.5">
                Slower ticks (8-10s) are easier to follow during a demo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRunning(v => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                running
                  ? 'bg-accent-strong text-accent-ink hover:opacity-90'
                  : 'bg-accent text-accent-ink hover:bg-accent-strong'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  running ? 'bg-accent-ink animate-pulse' : 'bg-accent-ink/60'
                }`}
                aria-hidden
              />
              {running ? 'Stop simulator' : 'Start simulator'}
            </button>

            <button
              type="button"
              onClick={async () => {
                // Pause the simulator's auto-tick while we inject the spike
                // and run inference. Without this, a baseline tick can land
                // between the spike batch and the worker's read, which
                // leaves a non-anomalous reading as the chronological tail
                // of the device and shifts the per-device mean baseline.
                const wasRunning = running;
                setRunning(false);
                try {
                  await injectMutation.mutateAsync({ wattage: 3500, count: 3 });
                  await runMlMutation.mutateAsync();
                } finally {
                  if (wasRunning) setRunning(true);
                }
              }}
              disabled={injectMutation.isPending || runMlMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-signal-soft text-signal-strong border border-signal-strong hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <BoltIcon sx={{ fontSize: 18 }} />
              Spike + run inference
            </button>

            <button
              type="button"
              onClick={() => runMlMutation.mutate()}
              disabled={runMlMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold border border-line-strong text-ink hover:bg-elevated transition-colors disabled:opacity-50"
            >
              {runMlMutation.isPending ? 'Running…' : 'Run inference now'}
            </button>
          </div>

          {(lastRun || runError) && (
            <div className="mt-5 pt-4 border-t border-line text-xs">
              {runError ? (
                <p className="text-signal-strong">
                  <span className="font-semibold uppercase tracking-wider mr-2">Error</span>
                  {runError}
                </p>
              ) : lastRun?.skipped_no_readings ? (
                <p className="text-ink-2">
                  <span className="font-semibold uppercase tracking-wider text-ink-3 mr-2">
                    No new readings
                  </span>
                  Worker had nothing to score. Cursor at{' '}
                  <span className="tabular">{lastRun.cursor ?? '—'}</span>.
                </p>
              ) : lastRun ? (
                <div className="space-y-1.5">
                  <p className="text-ink-2">
                    <span className="font-semibold uppercase tracking-wider text-accent mr-2">
                      Last run
                    </span>
                    processed{' '}
                    <span className="text-ink font-medium tabular">{lastRun.processed}</span>,
                    alerts triggered{' '}
                    <span className="text-ink font-medium tabular">
                      {lastRun.alerts_triggered}
                    </span>
                    , pushed{' '}
                    <span className="text-ink font-medium tabular">{lastRun.pushed}</span>
                    {lastRun.push_failures && lastRun.push_failures > 0 ? (
                      <>
                        , push failures{' '}
                        <span className="text-signal-strong font-medium tabular">
                          {lastRun.push_failures}
                        </span>
                      </>
                    ) : null}
                    . Cursor →{' '}
                    <span className="tabular">{lastRun.cursor ?? '—'}</span>.
                  </p>
                  <p className="text-ink-3">
                    <span className="uppercase tracking-wider mr-2">Predictor</span>
                    {lastRun.model_loaded ? (
                      <span className="text-ink-2">joblib model loaded</span>
                    ) : (
                      <span className="text-ink-2">
                        fallback baseline (no joblib model — using per-device pre-cursor mean)
                      </span>
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-ink-3 leading-relaxed space-y-3">
          <p>
            <strong>Demo flow.</strong> Click <strong>Start simulator</strong>{' '}
            to begin pumping realistic readings, then click{' '}
            <strong>Spike + run inference</strong>. The simulator auto-pauses
            while three 3500 W readings land back-to-back, the worker scores
            them, and a Contract C alert lands in Django. The dashboard's
            red urgent banner should appear within a few seconds.
          </p>
          <p>
            <strong>How the simulator shapes data.</strong> Each tick is a
            mean-reverting random walk around 450 W with ±150 W noise. Every
            ~8th tick fires a burst (microwave / kettle / aircon compressor
            kicking in) of 400-700 W on top. Values are clamped to
            [150, 1600] W — never below the fridge floor, never beyond what
            a single household circuit would plausibly draw.
          </p>
        </div>
      </div>
    </div>
  );
}
