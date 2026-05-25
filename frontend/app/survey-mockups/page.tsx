'use client';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';

type Day = { date: string; label: string; kwh: number };

const dailyConsumption: Day[] = [
  { date: '04-25', label: 'Apr 25', kwh: 5.3 },
  { date: '04-26', label: 'Apr 26', kwh: 5.6 },
  { date: '04-27', label: 'Apr 27', kwh: 5.1 },
  { date: '04-28', label: 'Apr 28', kwh: 5.4 },
  { date: '04-29', label: 'Apr 29', kwh: 5.7 },
  { date: '04-30', label: 'Apr 30', kwh: 5.2 },
  { date: '05-01', label: 'May 1', kwh: 5.5 },
  { date: '05-02', label: 'May 2', kwh: 5.0 },
  { date: '05-03', label: 'May 3', kwh: 5.4 },
  { date: '05-04', label: 'May 4', kwh: 5.3 },
  { date: '05-05', label: 'May 5', kwh: 5.6 },
  { date: '05-06', label: 'May 6', kwh: 5.2 },
  { date: '05-07', label: 'May 7', kwh: 5.5 },
  { date: '05-08', label: 'May 8', kwh: 5.4 },
  { date: '05-09', label: 'May 9', kwh: 5.7 },
  { date: '05-10', label: 'May 10', kwh: 5.3 },
  { date: '05-11', label: 'May 11', kwh: 5.5 },
  { date: '05-12', label: 'May 12', kwh: 5.1 },
  { date: '05-13', label: 'May 13', kwh: 5.4 },
  { date: '05-14', label: 'May 14', kwh: 5.6 },
  { date: '05-15', label: 'May 15', kwh: 13.2 },
  { date: '05-16', label: 'May 16', kwh: 5.4 },
  { date: '05-17', label: 'May 17', kwh: 5.3 },
  { date: '05-18', label: 'May 18', kwh: 5.5 },
  { date: '05-19', label: 'May 19', kwh: 5.2 },
  { date: '05-20', label: 'May 20', kwh: 5.6 },
  { date: '05-21', label: 'May 21', kwh: 5.4 },
  { date: '05-22', label: 'May 22', kwh: 5.7 },
  { date: '05-23', label: 'May 23', kwh: 5.3 },
  { date: '05-24', label: 'May 24', kwh: 5.5 },
];

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-dashed border-line">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-3">
        Screenshot {n.toString().padStart(2, '0')}
      </p>
      <h2 className="font-display text-2xl text-ink mt-1.5">{title}</h2>
    </div>
  );
}

function ConsumptionChart() {
  const width = 720;
  const height = 240;
  const padding = { top: 32, right: 24, bottom: 32, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxY = 16;

  const points = dailyConsumption.map((d, i) => ({
    x: padding.left + (i / (dailyConsumption.length - 1)) * chartW,
    y: padding.top + (1 - d.kwh / maxY) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const baselineY = padding.top + (1 - 5.4 / maxY) * chartH;
  const spike = points.find(p => p.date === '05-15')!;
  const xLabelIndexes = [0, 7, 14, 20, 22, 29];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Daily consumption chart">
      {[0, 4, 8, 12, 16].map(y => {
        const yPos = padding.top + (1 - y / maxY) * chartH;
        return (
          <g key={y}>
            <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos}
                  stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={padding.left - 8} y={yPos + 3} textAnchor="end"
                  fontSize="9" fill="var(--color-ink-3)" fontFamily="var(--font-jetbrains)">
              {y}
            </text>
          </g>
        );
      })}

      <line x1={padding.left} y1={baselineY} x2={width - padding.right} y2={baselineY}
            stroke="var(--color-ember)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      <text x={width - padding.right} y={baselineY - 4} textAnchor="end"
            fontSize="9" fill="var(--color-ember)" fontFamily="var(--font-inter)" fontWeight="600">
        baseline 5.4 kWh
      </text>

      <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="1.75"
            strokeLinejoin="round" strokeLinecap="round" />

      {points.map(p => (
        <circle key={p.date} cx={p.x} cy={p.y} r={p.date === '05-15' ? 5 : 1.8}
                fill={p.date === '05-15' ? 'var(--color-signal-strong)' : 'var(--color-accent)'}
                stroke={p.date === '05-15' ? 'var(--color-surface)' : 'none'}
                strokeWidth={p.date === '05-15' ? 2 : 0} />
      ))}

      <line x1={spike.x} y1={spike.y - 8} x2={spike.x} y2={spike.y - 28}
            stroke="var(--color-ink-3)" strokeWidth="1" strokeDasharray="2 2" />

      <g transform={`translate(${spike.x - 86}, ${spike.y - 56})`}>
        <rect width="172" height="28" rx="4" fill="var(--color-ink)" />
        <text x="10" y="12" fontSize="9.5" fill="var(--color-ink-inverse)"
              fontFamily="var(--font-inter)" fontWeight="600">May 15, 2:00 PM</text>
        <text x="10" y="22" fontSize="9.5" fill="var(--color-ink-inverse)"
              fontFamily="var(--font-jetbrains)" fontWeight="500">3.8 kW spike</text>
      </g>

      {xLabelIndexes.map(i => (
        <text key={i} x={points[i].x} y={height - 10} textAnchor="middle"
              fontSize="9" fill="var(--color-ink-3)" fontFamily="var(--font-inter)">
          {points[i].label}
        </text>
      ))}
    </svg>
  );
}

function DashboardMockup() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-line rounded-lg bg-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Monthly consumption</p>
            <BoltOutlinedIcon sx={{ fontSize: 18, color: 'var(--color-ink-3)' }} />
          </div>
          <p className="font-readout text-4xl text-ink leading-none">
            162 <span className="text-base font-sans font-normal text-ink-3">kWh</span>
          </p>
          <p className="text-xs text-ink-3 mt-3 tabular">Apr 25 &ndash; May 24, 2026</p>
        </div>

        <div className="border border-line rounded-lg bg-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Estimated cost</p>
            <AttachMoneyIcon sx={{ fontSize: 18, color: 'var(--color-ink-3)' }} />
          </div>
          <p className="font-readout text-4xl text-ink leading-none">
            <span className="text-ink-3 text-base font-sans font-normal align-top mr-0.5">&#8369;</span>
            2,326.43
          </p>
          <p className="text-xs text-ink-3 mt-3 tabular">at &#8369;14.36 per kWh</p>
        </div>

        <div className="border border-line rounded-lg bg-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Current load</p>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-success font-medium">Live</span>
            </span>
          </div>
          <p className="font-readout text-4xl text-ink leading-none">
            410 <span className="text-base font-sans font-normal text-ink-3">W</span>
          </p>
          <p className="text-xs text-ink-3 mt-3">Sub-meter connected</p>
        </div>
      </div>

      <div className="border border-line rounded-lg bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <div>
            <h3 className="font-display text-lg text-ink">Daily consumption</h3>
            <p className="text-xs text-ink-3 mt-1 tabular">Apr 25 &ndash; May 24, 2026 &middot; kWh</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Daily total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 bg-ember" />
              Baseline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-signal-strong" />
              Anomaly
            </span>
          </div>
        </div>
        <ConsumptionChart />
      </div>

      <div className="border border-line rounded-lg bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg text-ink">Monthly budget</h3>
            <p className="text-xs text-ink-3 mt-1">11 days remaining in the billing cycle</p>
          </div>
          <p className="text-sm text-ink-2">
            <span className="font-readout text-ink">&#8369;2,326.43</span>
            <span className="text-ink-3"> of </span>
            <span className="font-readout">&#8369;3,000.00</span>
          </p>
        </div>
        <div className="h-2.5 bg-elevated rounded-full overflow-hidden relative">
          <div className="h-full bg-accent rounded-full" style={{ width: '77.5%' }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider font-medium text-ink-3">
          <span className="font-readout text-accent">77.5% used</span>
          <span className="font-readout">&#8369;673.57 left</span>
        </div>
      </div>
    </div>
  );
}

function OcrMockup() {
  const billLines = [
    'M E R A L C O',
    'Manila Electric Company',
    '',
    'Customer:    ████████████',
    'Address:     ████████████',
    '             ████████, Manila',
    '',
    'CAN:         0465187009',
    'Meter:       33RZN24460',
    'Period:      04/25/2026 - 05/24/2026',
    'Due Date:    06/04/2026',
    '',
    '──────────────────────────────',
    '  READING',
    '  Previous:           3,312',
    '  Current:            3,474',
    '  Consumption:        162 kWh',
    '──────────────────────────────',
    '  CHARGES',
    '  Generation:    ₱ 1,824.30',
    '  Transmission:  ₱   214.50',
    '  Distribution:  ₱   185.20',
    '  System loss:   ₱    52.80',
    '  Metering:      ₱    18.50',
    '  Universal:     ₱    31.13',
    '──────────────────────────────',
    '  TOTAL DUE:     ₱ 2,326.43',
    '',
  ].join('\n');

  const fields: Array<[string, string, boolean?]> = [
    ['Account Number (CAN)', '0465187009'],
    ['Billing Period', 'Apr 25, 2026 – May 24, 2026'],
    ['Meter Number', '33RZN24460'],
    ['Total kWh Consumed', '162.00 kWh'],
    ['Total Bill Amount', '₱ 2,326.43'],
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="border border-line rounded-lg bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Source document</p>
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-success-soft text-success font-medium">
            <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />
            OCR complete &middot; 100% match
          </span>
        </div>
        <pre className="px-6 py-5 font-mono text-[11px] leading-relaxed text-ink whitespace-pre m-0 overflow-x-auto">
{billLines}
        </pre>
      </div>

      <div className="border border-line rounded-lg bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Extracted fields</p>
        </div>
        <dl className="px-6 py-3 divide-y divide-line">
          {fields.map(([label, value]) => (
            <div key={label} className="py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-xs uppercase tracking-wider text-ink-3 font-medium">{label}</dt>
              <dd className="font-readout text-sm text-ink">{value}</dd>
            </div>
          ))}
          <div className="py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <dt className="text-xs uppercase tracking-wider text-ink-3 font-medium">Confidence score</dt>
            <dd className="inline-flex items-center gap-2 text-sm">
              <span className="inline-block h-1.5 w-16 rounded-full bg-elevated overflow-hidden">
                <span className="block h-full bg-success" style={{ width: '99.8%' }} />
              </span>
              <span className="font-readout text-success">99.8%</span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success-soft text-success font-medium">
                <CheckCircleOutlineIcon sx={{ fontSize: 11 }} />
                Verified
              </span>
            </dd>
          </div>
        </dl>
        <div className="px-6 py-4 border-t border-line bg-page">
          <p className="text-xs text-ink-3 leading-relaxed">
            All fields successfully matched against the source document. Record saved to database
            under <span className="font-readout text-ink">CAN 0465187009</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function AnomalyMockup() {
  return (
    <ul className="space-y-3">
      <li className="border border-signal-soft rounded-lg bg-surface">
        <div className="px-6 py-5 flex gap-4 items-start">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-strong">
            <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <h3 className="font-display text-base text-ink tracking-tight">
                High usage anomaly detected
              </h3>
              <span className="text-[10px] uppercase tracking-[0.14em] text-signal-strong font-semibold">
                Active
              </span>
              <span className="text-xs text-ink-3 font-readout">
                Fri, May 15, 2026 &middot; 2:00 PM
              </span>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              Usage exceeded historical hourly average by{' '}
              <span className="font-readout text-signal-strong">280%</span>. Pattern indicates
              high-wattage appliances (such as an air conditioner or electric oven) running
              continuously.
            </p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4 pt-3 border-t border-line">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-3 mb-1">Expected load</dt>
                <dd className="font-readout text-sm text-ink">0.4 &ndash; 1.0 kW</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-3 mb-1">Actual load</dt>
                <dd className="font-readout text-sm text-signal-strong">
                  3.8 kW <span className="font-sans text-xs text-ink-3 font-normal">(out of bounds)</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </li>

      <li className="border border-line rounded-lg bg-surface">
        <div className="px-6 py-5 flex gap-4 items-start">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <h3 className="font-display text-base text-ink tracking-tight">Billing telemetry check</h3>
              <span className="text-[10px] uppercase tracking-[0.14em] text-success font-semibold">
                Resolved
              </span>
              <span className="text-xs text-ink-3 font-readout">May 24, 2026</span>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              OCR-extracted bill matches live sub-meter telemetry calculations.
              {' '}
              <span className="text-ink">Variance: <span className="font-readout">0.02 kWh</span>.</span>
            </p>
          </div>
        </div>
      </li>

      <li className="border border-line rounded-lg bg-surface">
        <div className="px-6 py-5 flex gap-4 items-start">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <InfoOutlinedIcon sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <h3 className="font-display text-base text-ink tracking-tight">Hardware connected</h3>
              <span className="text-[10px] uppercase tracking-[0.14em] text-accent-strong font-semibold">
                System
              </span>
              <span className="text-xs text-ink-3 font-readout">Apr 25, 2026</span>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed inline-flex items-center gap-2 flex-wrap">
              <DeveloperBoardIcon sx={{ fontSize: 16, color: 'var(--color-ink-3)' }} />
              ESP32 sub-meter initialized successfully. Baseline sync complete.
            </p>
          </div>
        </div>
      </li>
    </ul>
  );
}

function ChatbotMockup() {
  return (
    <div className="border border-line rounded-lg bg-surface overflow-hidden max-w-2xl">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">Bill assistant</h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Online
        </span>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="flex justify-end">
          <div className="max-w-[85%]">
            <div className="px-3.5 py-2.5 rounded-lg rounded-br-sm bg-accent text-accent-ink">
              <p className="text-sm leading-relaxed">Why is my bill high this month?</p>
            </div>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[92%]">
            <div className="px-3.5 py-3 rounded-lg rounded-bl-sm bg-page text-ink border border-line">
              <p className="text-sm leading-relaxed">
                Your total consumption for this billing period (Apr 25 &ndash; May 24, 2026) is{' '}
                <span className="font-readout">162 kWh</span>, totaling{' '}
                <span className="font-readout">&#8369;2,326.43</span> at an average rate of{' '}
                <span className="font-readout">&#8369;14.36</span> per kWh.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Our database analysis detected a significant usage spike on Friday, May 15, at 2:00 PM,
                where consumption surged to <span className="font-readout">3.8 kW</span>&mdash;nearly 10
                times your normal afternoon baseline of <span className="font-readout">0.4 kW</span>. This
                pattern typically occurs when multiple high-load appliances (such as an air conditioner and
                an iron or water heater) are used simultaneously.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                By avoiding concurrent use of heavy appliances and running your air conditioner on
                eco-mode, you can easily save approximately{' '}
                <span className="font-readout text-success">&#8369;350.00</span> on your next monthly
                cycle.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form className="px-5 py-4 border-t border-line" onSubmit={e => e.preventDefault()}>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-md border border-line-strong text-ink-2 hover:text-ink hover:bg-elevated transition-colors"
            aria-label="Attach file"
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </button>
          <input
            type="text"
            placeholder="Ask anything about your energy bill..."
            className="flex-1 px-3 py-2.5 rounded-md border border-line-strong bg-page text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            readOnly
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-md bg-ink text-ink-inverse hover:bg-ink-2 transition-colors"
            aria-label="Send"
          >
            <SendIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SurveyMockupsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-20">
      <header className="pb-6 border-b border-line">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-accent mb-2">
          Internal &middot; research mockups
        </p>
        <h1 className="font-display text-3xl text-ink tracking-tight">
          Quantitative survey screenshots
        </h1>
        <p className="text-sm text-ink-2 mt-3 max-w-2xl leading-relaxed">
          Hardcoded mockups for the paper-vs-digital billing comparison study. Each labeled section
          below is intended for one screenshot. Scroll, then crop or capture as needed.
        </p>
      </header>

      <section>
        <SectionLabel n={1} title="Dashboard overview panel" />
        <DashboardMockup />
      </section>

      <section>
        <SectionLabel n={2} title="OCR bill digitization module" />
        <OcrMockup />
      </section>

      <section>
        <SectionLabel n={3} title="ML anomaly alerts panel" />
        <AnomalyMockup />
      </section>

      <section>
        <SectionLabel n={4} title="Conversational AI chatbot interface" />
        <ChatbotMockup />
      </section>
    </div>
  );
}
