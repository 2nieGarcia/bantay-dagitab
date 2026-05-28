'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Cookies from 'js-cookie';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/shared/brand';
import { API_URL } from '@/lib/api';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'framer-motion';
import { 
  Activity, AlertTriangle, BarChart3, ShieldCheck, Cpu, 
  Settings, Lock, FileDigit, Plug, Server, ChevronDown, Zap, Database, Bell
} from 'lucide-react';

const faqs = [
  {
    question: "What is Bantay Dagitab and what does it do?",
    answer: "Bantay Dagitab is a unified energy management system designed to help post-paid MERALCO residential consumers in Metro Manila avoid \"bill shock\". It combines a real-time IoT energy tracker, an Optical Character Recognition (OCR) module that digitizes your physical paper bills, and an AI-powered dashboard. The system features a conversational AI chatbot that translates complex energy data into plain-language explanations and provides personalized energy-saving recommendations."
  },
  {
    question: "What hardware is required to monitor my home's energy consumption?",
    answer: "The system requires a low-cost IoT sub-metering module powered by an ESP32 Wi-Fi microcontroller. This is paired with non-invasive Current Transformer (CT) sensors (such as the SCT-013) and voltage sensors. These sensors safely clamp onto your existing power lines to read localized household wattage and push data to the cloud every 15 minutes, operating independently without needing to replace your main utility meter."
  },
  {
    question: "How accurate is the system in tracking my electricity usage and reading my bills?",
    answer: "The hardware tracking is highly precise; local studies validate that these microcontrollers and sensors can capture real-time energy telemetry with an accuracy deviation as low as -0.03 kWh, achieving up to 98.5% precision. For digitizing physical MERALCO statements, the OCR module utilizes deep learning architectures targeting a field extraction accuracy of ≥85%."
  },
  {
    question: "How does the system detect anomalies or spikes in my energy usage?",
    answer: "The system uses a machine-learning anomaly detection layer that continuously compares your real-time incoming IoT telemetry against your historical baseline usage. It utilizes forecasting models to calculate an expected prediction interval (an expected wattage range) for any given hour. If your actual wattage exceeds the maximum limit of this expected range, the system instantly flags it as a consumption spike and triggers an alert."
  },
  {
    question: "How is my personal data and energy information kept secure?",
    answer: "Bantay Dagitab is built to strictly comply with the Philippine Data Privacy Act of 2012 (RA 10173). User identifiers are hashed at the device level, and no Personally Identifiable Information (PII) is used in training the machine learning models. At the database layer, security is enforced through JWT token authentication, Role-Based Access Control (RBAC), transport security (TLS), and data-at-rest encryption."
  }
];
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

function FeatureCard({ f, i }: { f: any, i: number }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  return (
    <motion.div
      variants={itemVariants}
      onMouseMove={(e) => {
        const { left, top } = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - left);
        mouseY.set(e.clientY - top);
      }}
      className="group relative p-8 rounded-2xl border border-line bg-surface overflow-hidden transition-all cursor-default shadow-sm hover:shadow-md"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(56, 189, 248, 0.15), transparent 80%)`,
        }}
      />
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-ink text-ink-inverse flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-ink transition-colors">
          {f.icon}
        </div>
        <h3 className="text-lg font-semibold text-ink mb-3 tracking-tight">{f.title}</h3>
        <p className="text-sm text-ink-2 leading-relaxed">{f.desc}</p>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { t } = useLang();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Dynamic content for the sample UI
  const [sampleData, setSampleData] = useState({
    projection: 2847,
    contextAmount: 430,
    consumption: 234.5,
    alerts: 1,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSampleData(prev => {
        // Randomly trigger a new alert rarely (e.g. 5% chance per tick)
        const newAlert = Math.random() < 0.05 ? 1 : 0;
        return {
          projection: prev.projection + Math.floor(Math.random() * 5) - 1,
          contextAmount: prev.contextAmount,
          consumption: Number((prev.consumption + 0.01 + Math.random() * 0.02).toFixed(1)),
          alerts: prev.alerts + newAlert,
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoggedIn(!!Cookies.get('access_token'));

    const fetchStatus = async () => {
      try {
        const baseUrl = API_URL.replace(/\/api\/?$/, '');
        const res = await fetch(`${baseUrl}/health/`);
        if (res.ok) {
          setSystemStatus('online');
        } else {
          setSystemStatus('offline');
        }
      } catch {
        setSystemStatus('offline');
      }
    };
    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[85vw] flex items-center justify-between px-6 py-5">
          <Brand size="md" />
          <nav className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-2">
              <a href="#features" className="hover:text-ink transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-ink transition-colors">How it Works</a>
              <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-1">
              {mounted && isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-medium rounded-md bg-ink text-ink-inverse hover:bg-ink-2 transition-colors"
                >
                  {t('common.openDashboard')}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
                  >
                    {t('common.signIn')}
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 text-sm font-medium rounded-md bg-ink text-ink-inverse hover:bg-ink-2 transition-colors"
                  >
                    {t('common.signUp')}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <motion.section 
        className="mx-auto max-w-[85vw] px-6 pt-20 pb-16"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10 items-end">
          <div className="lg:col-span-8">
            <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-5">
              {t('home.kicker')}
            </motion.p>
            <motion.h1 variants={itemVariants} className="font-display text-5xl md:text-6xl lg:text-7xl text-ink leading-[1.02]">
              {t('home.headline1')}
              <br />
              <span className="font-normal text-ink-3">{t('home.headline2')}</span>
            </motion.h1>
          </div>
          <div className="lg:col-span-4">
            <motion.p variants={itemVariants} className="text-base text-ink-2 leading-relaxed max-w-md">{t('home.lede')}</motion.p>
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 mt-7">
              <Link
                href={mounted && isLoggedIn ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors"
              >
                {mounted && isLoggedIn ? t('common.openDashboard') : t('common.signIn')}
                <motion.span 
                  aria-hidden 
                  initial={{ x: 0 }} 
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block"
                >
                  →
                </motion.span>
              </Link>
              <Link
                href="/bills"
                className="inline-flex items-center px-5 py-3 rounded-md border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
              >
                {t('common.uploadBill')}
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section 
        className="border-y border-line bg-circuit"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto max-w-[85vw] px-6 py-16">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-ink-3 mb-10">
            {t('home.sampleLabel')}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-end">
            <div className="lg:col-span-8">
              <p className="text-sm text-ink-2 mb-3 font-medium">{t('home.sample.projection')}</p>
              <p className="font-readout text-7xl md:text-8xl text-ink leading-none flex items-start">
                <span className="text-ink-3 mt-3 text-3xl md:text-4xl mr-2 font-normal font-sans">₱</span>
                <span className="relative inline-flex overflow-hidden h-[1.1em]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={sampleData.projection}
                      initial={{ y: "-100%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: "100%", opacity: 0 }}
                      transition={{ type: "spring", stiffness: 150, damping: 15 }}
                      className="inline-block"
                    >
                      {sampleData.projection.toLocaleString()}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </p>
              <p className="text-base md:text-lg text-ink-2 mt-6 max-w-xl leading-relaxed">
                {t('home.sample.context', { amount: '' }).split('{amount}')[0]}
                <span className="font-readout text-signal-strong">₱{sampleData.contextAmount}</span>
                {t('home.sample.context', { amount: '' }).split('{amount}')[1]}
              </p>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-6 lg:gap-8 lg:border-l lg:border-line-strong lg:pl-12">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('home.sample.consumption')}
                </p>
                <p className="font-readout text-3xl text-ink mt-2 leading-none">
                  <motion.span
                    key={sampleData.consumption}
                    initial={{ scale: 1.1, color: 'var(--color-accent)' }}
                    animate={{ scale: 1, color: 'var(--color-ink)' }}
                    transition={{ duration: 0.8 }}
                    className="inline-block"
                  >
                    {sampleData.consumption.toFixed(1)}
                  </motion.span> <span className="text-base text-ink-3 font-sans font-normal">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3 font-semibold">
                  {t('home.sample.alerts')}
                </p>
                <p className="font-display text-3xl text-signal-strong mt-2 leading-none">
                  <motion.span 
                    key={sampleData.alerts}
                    initial={{ scale: 1.5, color: '#f87171' }}
                    animate={{ scale: 1, color: 'var(--color-signal-strong)' }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="inline-block"
                  >
                    {sampleData.alerts > 0 ? `${sampleData.alerts} Active Alert${sampleData.alerts > 1 ? 's' : ''}` : 'No Alerts'}
                  </motion.span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section 
        className="border-y border-line bg-page py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="mx-auto max-w-[85vw] px-6">
          <div className="text-center mb-16">
            <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-signal-strong mb-4">
              The Problem
            </motion.p>
            <motion.h2 variants={itemVariants} className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Why traditional billing falls short
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24">
            {[
              { title: "Bill Shock", desc: "You only find out how much electricity you consumed at the end of the month when the bill arrives.", icon: <AlertTriangle className="w-12 h-12 text-red-500 mb-6" /> },
              { title: "Unmonitored Appliances", desc: "Faulty appliances drain power silently without you ever knowing until it's too late.", icon: <Activity className="w-12 h-12 text-red-500 mb-6" /> },
              { title: "Delayed Interventions", desc: "No way to proactively cut down consumption during peak hours or abnormal usage spikes.", icon: <BarChart3 className="w-12 h-12 text-red-500 mb-6" /> }
            ].map((prob, idx) => (
              <motion.div key={idx} variants={itemVariants} className="p-12 rounded-3xl border border-red-500/40 bg-red-500/10 flex flex-col items-center text-center shadow-lg shadow-red-500/5">
                {prob.icon}
                <h3 className="text-2xl font-semibold text-ink mb-4">{prob.title}</h3>
                <p className="text-base text-ink-2 leading-relaxed">{prob.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section 
        className="border-y border-line bg-circuit-dark py-24"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto max-w-[85vw] px-6 text-center">
          <motion.p variants={itemVariants} className="text-sm uppercase tracking-[0.2em] font-bold text-accent mb-6">
            The Solution
          </motion.p>
          <motion.h2 variants={itemVariants} className="font-display text-4xl md:text-5xl text-ink-inverse tracking-tight mb-8 leading-snug">
            Bantay Dagitab brings the power of AI and real-time IoT monitoring directly to your home.
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-ink-inverse/80 max-w-3xl mx-auto">
            No more waiting in line. No more surprise bills. Total control in your pocket.
          </motion.p>
        </div>
      </motion.section>

      <motion.section 
        id="features"
        className="mx-auto max-w-[85vw] px-6 py-24"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="text-center mb-16">
          <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
            Features
          </motion.p>
          <motion.h2 variants={itemVariants} className="font-display text-3xl md:text-4xl text-ink tracking-tight">
            Intelligent Energy <span className="text-sky-500">Management</span>
          </motion.h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {[
            { icon: <Activity className="w-6 h-6" />, title: 'Real-time Monitoring', desc: 'Track your household wattage second-by-second using localized IoT sensors.' },
            { icon: <AlertTriangle className="w-6 h-6" />, title: 'Anomaly Detection', desc: 'Instant alerts when your consumption spikes above historical baseline ranges.' },
            { icon: <Cpu className="w-6 h-6" />, title: 'Machine Learning Engine', desc: 'LightGBM and LSTM forecasting models predict your expected usage accurately.' },
            { icon: <Settings className="w-6 h-6" />, title: 'Custom Thresholds', desc: 'Set your own budget limits and receive SMS/Email notifications when nearing them.' },
            { icon: <BarChart3 className="w-6 h-6" />, title: 'Historical Analytics', desc: 'Visualize your daily, weekly, and monthly consumption trends effortlessly.' },
            { icon: <Plug className="w-6 h-6" />, title: 'Hardware Agnostic', desc: 'Works with low-cost ESP32 modules and standard Current Transformer (CT) sensors.' },
          ].map((f, i) => (
            <FeatureCard key={i} f={f} i={i} />
          ))}
        </div>
      </motion.section>

      {/* Section 5: Removed per request */}

      {/* Section 6: How It Works */}
      <motion.section 
        id="how-it-works"
        className="border-t border-line bg-page py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="mx-auto max-w-[85vw] px-6">
          <div className="text-center mb-16">
            <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
              How It Works
            </motion.p>
            <motion.h2 variants={itemVariants} className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Three steps to <span className="text-sky-500">smarter consumption</span>
            </motion.h2>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {/* Horizontal line to connect the steps (desktop only) */}
            <div className="hidden md:block absolute top-6 left-[16.66%] right-[16.66%] h-[2px] bg-line z-0 overflow-hidden rounded-full">
              <motion.div 
                animate={{ left: ["-20%", "120%"] }} 
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 bottom-0 w-[30%] bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_8px_rgba(250,204,21,0.8)]" 
              />
            </div>
            
            {[
              { step: '01', title: 'Provision', desc: 'Create an account and generate a secure device credential for your home.', icon: <FileDigit className="w-5 h-5" /> },
              { step: '02', title: 'Connect', desc: 'Plug in your sensor. Telemetry data instantly streams to your dashboard.', icon: <Activity className="w-5 h-5" /> },
              { step: '03', title: 'Monitor', desc: 'Let our ML engines analyze your habits and alert you to any anomalies.', icon: <Bell className="w-5 h-5" /> }
            ].map((s, idx) => (
              <motion.div key={idx} variants={itemVariants} className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 bg-page border-[3px] border-accent text-accent rounded-full flex items-center justify-center mb-6 shadow-sm">
                  {s.icon}
                </div>
                <p className="font-readout text-xl text-ink-3 mb-2">{s.step}</p>
                <h3 className="text-lg font-semibold text-ink mb-3">{s.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed max-w-[260px] mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Section 7: Trust & Security */}
      <motion.section 
        className="border-t border-line bg-surface py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="mx-auto max-w-[85vw] px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
              Trust & Security
            </motion.p>
            <motion.h2 variants={itemVariants} className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-6">
              Bank-grade security <span className="text-sky-500">for your data</span>
            </motion.h2>
            <motion.p variants={itemVariants} className="text-base text-ink-2 leading-relaxed">
              We understand the sensitivity of your household data. Bantay Dagitab is engineered from the ground up to protect your privacy and ensure the highest standards of data integrity.
            </motion.p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'Secure Data Storage', desc: 'End-to-end TLS encryption and AES-256 data-at-rest encryption.', icon: <Database className="w-7 h-7 text-ink-inverse" /> },
              { title: 'Validated ML Models', desc: 'Our forecasting engines are strictly sandboxed and rigorously tested.', icon: <ShieldCheck className="w-7 h-7 text-ink-inverse" /> },
              { title: 'Local Processing', desc: 'Sensor data is hashed at the edge before hitting our cloud infrastructure.', icon: <Server className="w-7 h-7 text-ink-inverse" /> },
              { title: 'Data Privacy', desc: '100% compliance with RA 10173. No PII is used for training our models.', icon: <Lock className="w-7 h-7 text-ink-inverse" /> }
            ].map((t, idx) => (
              <motion.div 
                key={idx} 
                variants={itemVariants} 
                whileHover={{ scale: 1.05, rotateX: 5, rotateY: -5, zIndex: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="p-6 rounded-xl border border-line bg-page hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)] relative flex items-start gap-5"
                style={{ perspective: 1000 }}
              >
                <div className="w-14 h-14 shrink-0 bg-ink rounded-xl flex items-center justify-center shadow-md">
                  {t.icon}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-ink mb-1">{t.title}</h4>
                  <p className="text-sm text-ink-2 leading-relaxed">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Section 8: FAQ */}
      <motion.section 
        id="faq"
        className="border-t border-line bg-page py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-16">
            <motion.p variants={itemVariants} className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
              Knowledge Base
            </motion.p>
            <motion.h2 variants={itemVariants} className="font-display text-3xl md:text-4xl text-ink tracking-tight">
              Frequently Asked <span className="text-sky-500">Questions</span>
            </motion.h2>
          </div>
          <motion.div variants={itemVariants} className="space-y-4 min-h-[550px] md:min-h-[450px]">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-line rounded-xl bg-surface overflow-hidden">
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                >
                  <span className="font-semibold text-ink pr-4">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 text-sm text-ink-2 leading-relaxed border-t border-line/50 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Section 9: Bottom CTA Block (Extra Tall with Pop-up Reveal) */}
      <motion.section 
        className="border-t border-line bg-ink text-ink-inverse min-h-[150vh] flex flex-col items-center justify-center relative overflow-hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Pop-up container triggers lower down the screen and only fires once */}
        <motion.div 
          className="mx-auto max-w-[85vw] px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10"
          initial="pop"
          whileInView="spread"
          viewport={{ once: true, margin: "-40% 0px" }}
          variants={{
            pop: { opacity: 0, y: 150, scale: 0.95 },
            spread: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 20 } }
          }}
        >
          <motion.div
            variants={{
              pop: { x: "22vw" },
              spread: { x: 0, transition: { delay: 0.6, type: 'spring', stiffness: 80, damping: 20 } }
            }}
          >
            <motion.h2 
              variants={itemVariants}
              className="font-display text-5xl md:text-6xl tracking-tight mb-8"
            >
              Ready to make the leap?
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-ink-inverse/80 mb-12 max-w-lg leading-relaxed">
              Join us and start monitoring your electricity consumption intelligently. Identify anomalies, avoid bill shock, and build better energy habits today.
            </motion.p>
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-6">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-accent text-accent-ink text-base font-semibold hover:scale-105 hover:shadow-xl transition-all"
              >
                Sign Up Now
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-ink-inverse/30 text-ink-inverse text-base font-semibold hover:bg-ink-inverse/10 transition-all"
              >
                Log In
              </Link>
            </motion.div>
          </motion.div>
          <motion.div 
            className="aspect-[4/3] bg-page border border-line/20 rounded-3xl flex flex-col items-center justify-center p-2 shadow-2xl overflow-hidden relative"
            variants={{
              pop: { x: "-22vw", opacity: 0, scale: 0.8 },
              spread: { x: 0, opacity: 1, scale: 1, transition: { delay: 0.6, type: 'spring', stiffness: 80, damping: 20 } }
            }}
          >
            {/* Dashboard graphic */}
            <div className="w-full h-full rounded-2xl overflow-hidden relative border border-line">
              <Image 
                src="/images/dashboard-mockup.png" 
                alt="Bantay Dagitab Dashboard Mockup" 
                fill
                className="object-cover object-top"
                priority
              />
            </div>
            
            {/* Mock live ticker inside the graphic area */}
            <div className="absolute bottom-8 left-8 right-8 bg-surface rounded-xl p-6 shadow-xl border border-line flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center text-accent">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-ink-3 font-medium">Live Telemetry</p>
                  <p className="text-ink font-semibold">Online</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-3 font-medium">Consumption</p>
                <p className="text-ink font-readout text-xl">162 kWh</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Section 10: Expanded Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[85vw] px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <Brand size="sm" href={null} className="mb-6" />
              <p className="text-sm text-ink-2 leading-relaxed">
                A unified energy management system designed to help you avoid bill shock through real-time IoT tracking and AI insights.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-ink mb-6 uppercase tracking-wider text-sm">About Us</h4>
              <ul className="space-y-4 text-sm text-ink-2">
                <li><a href="#" className="hover:text-ink transition-colors">Our Mission</a></li>
                <li><a href="#how-it-works" className="hover:text-ink transition-colors">How It Works</a></li>
                <li><a href="#faq" className="hover:text-ink transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-ink mb-6 uppercase tracking-wider text-sm">Follow Us</h4>
              <ul className="space-y-4 text-sm text-ink-2">
                <li><a href="#" className="hover:text-ink transition-colors">Facebook</a></li>
                <li><a href="#" className="hover:text-ink transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-ink transition-colors">Twitter</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-ink mb-6 uppercase tracking-wider text-sm">Legal</h4>
              <ul className="space-y-4 text-sm text-ink-2">
                <li><a href="#" className="hover:text-ink transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-ink transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-ink transition-colors">Data Privacy Act</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-line flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${systemStatus === 'online' ? 'bg-[#10B981] animate-pulse' : systemStatus === 'offline' ? 'bg-[#EF4444]' : 'bg-ink-3'}`}></span>
              <span className="text-xs text-ink-3 font-medium uppercase tracking-wider">
                {systemStatus === 'loading' ? 'Checking Status...' : systemStatus === 'online' ? 'System Online' : 'System Offline'}
              </span>
            </div>
            <div className="flex gap-6 text-xs text-ink-3">
              <p>{t('home.footer.school')}</p>
              <p>{t('home.footer.sdg')}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
