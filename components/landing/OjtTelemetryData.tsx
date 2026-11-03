'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────────────────────────────────────
 * MINIMALIST DATA // TELEMETRY & SCALE
 *
 * Modeled after Neil's Portfolio "Minimalist Data. Zero noise."
 * Adapted 100% to PHINMA UI Dugtong OJT practicum metrics and trajectories:
 *   - 4-Card High-Density Metric Strip (Target, Velocity, Rate, Paperless)
 *   - 2 Glowing Minimalist SVG Curve Charts (Hours Trajectory & Attendance Rate)
 * ──────────────────────────────────────────────────────────────────────────── */

interface ChartPoint {
  label: string;
  hours: number;
  week: string;
}

const HOURS_TRAJECTORY: ChartPoint[] = [
  { label: 'Wk 1: Deployment', hours: 40, week: 'W1' },
  { label: 'Wk 3: Core Tasks', hours: 120, week: 'W3' },
  { label: 'Wk 6: Midterm Evaluation', hours: 240, week: 'W6' },
  { label: 'Wk 9: Advanced Projects', hours: 360, week: 'W9' },
  { label: 'Wk 12: Certification Target', hours: 486, week: 'W12' },
];

const container = 'mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]';

export default function OjtTelemetryData() {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);

  return (
    <section id="telemetry" className="border-b border-border bg-page-wash py-20 max-sm:py-14" data-reveal>
      <div className={container}>
        {/* Section Header (Matching Portfolio Image 2) */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-12">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-2">
              <span>02 // SYSTEM TELEMETRY // SCALE</span>
            </div>
            <h2 className="font-heading text-[clamp(32px,3.8vw,48px)] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
              Minimalist Data. <span className="text-primary font-normal">Zero paperwork.</span>
            </h2>
          </div>

          <p className="max-w-[460px] font-mono text-xs uppercase tracking-wider text-copy-muted leading-relaxed">
            Real-time practicum telemetry across student hour accumulation, same-day supervisor verification velocity, and server-authoritative audit logs.
          </p>
        </div>

        {/* ── 4-CARD HIGH-DENSITY KPI METRIC STRIP ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Target Hours */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
            <div className="font-mono text-[11px] font-bold tracking-wider text-primary uppercase">
              01 // PRACTICUM TARGET
            </div>
            <div className="my-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-ink tabular-nums">
                486
              </span>
              <span className="text-sm font-semibold text-copy-muted ml-1.5">hrs</span>
            </div>
            <div>
              <div className="text-xs font-bold text-ink">BSIT Course Requirement</div>
              <div className="text-[11px] text-copy-muted mt-0.5">
                Target required for final supervisor evaluation
              </div>
            </div>
          </div>

          {/* Card 2: Supervisor Approval Velocity */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
            <div className="font-mono text-[11px] font-bold tracking-wider text-primary uppercase">
              02 // APPROVAL VELOCITY
            </div>
            <div className="my-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-ink tabular-nums">
                &lt;24h
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-ink">Same-Day Review</div>
              <div className="text-[11px] text-copy-muted mt-0.5">
                Bulk approval queue prevents end-of-semester backlog
              </div>
            </div>
          </div>

          {/* Card 3: Authoritative On-Time DTR */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
            <div className="font-mono text-[11px] font-bold tracking-wider text-primary uppercase">
              03 // DTR VERIFICATION
            </div>
            <div className="my-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-ink tabular-nums">
                98.4%
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-ink">Asia/Manila Server Clock</div>
              <div className="text-[11px] text-copy-muted mt-0.5">
                Zero client device clock drift or timestamp tampering
              </div>
            </div>
          </div>

          {/* Card 4: Paperwork Overhead */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
            <div className="font-mono text-[11px] font-bold tracking-wider text-primary uppercase">
              04 // PAPERWORK OVERHEAD
            </div>
            <div className="my-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-ink tabular-nums">
                0%
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-ink">100% Digital Workflow</div>
              <div className="text-[11px] text-copy-muted mt-0.5">
                Automated certification PDF replaces lost physical sheets
              </div>
            </div>
          </div>
        </div>

        {/* ── 2 SLEEK MINIMALIST DATA CHARTS (Matching Portfolio Image 2) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Hours Accumulation Trajectory */}
          <div className="p-7 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-ink">Hours Accumulation Trajectory</div>
                <div className="font-mono text-xs text-primary font-semibold mt-0.5">
                  +40.0 HRS / WEEK • ESTIMATED COMPLETION: WEEK 12
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-primary-tint text-primary border border-primary/20">
                TREND: ACCELERATING
              </span>
            </div>

            {/* Glowing SVG Curve Chart */}
            <div className="relative pt-4">
              <svg viewBox="0 0 520 180" className="w-full h-44 overflow-visible">
                <defs>
                  {/* Glowing Gradient Fill */}
                  <linearGradient id="blueGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                    <stop offset="60%" stopColor="#2563eb" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                <line x1="20" y1="30" x2="500" y2="30" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="80" x2="500" y2="80" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="130" x2="500" y2="130" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Area Gradient Fill */}
                <path
                  d="M 25 155 Q 140 145, 220 115 T 410 45 L 495 25 L 495 160 L 25 160 Z"
                  fill="url(#blueGlow)"
                />

                {/* Main Glowing Trajectory Curve */}
                <path
                  d="M 25 155 Q 140 145, 220 115 T 410 45 L 495 25"
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="filter drop-shadow-[0_0_8px_rgba(37,99,235,0.45)]"
                />

                {/* Data Points */}
                {[
                  { cx: 25, cy: 155, label: 'W1: 40h' },
                  { cx: 140, cy: 140, label: 'W3: 120h' },
                  { cx: 250, cy: 105, label: 'W6: 240h' },
                  { cx: 375, cy: 55, label: 'W9: 360h' },
                  { cx: 495, cy: 25, label: 'W12: 486h' },
                ].map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.cx} cy={pt.cy} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                    <circle cx={pt.cx} cy={pt.cy} r="9" fill="#2563eb" fillOpacity="0.15" />
                  </g>
                ))}
              </svg>

              {/* Bottom Labels */}
              <div className="flex items-center justify-between text-[11px] font-mono text-copy-muted uppercase pt-2">
                <span>Wk 1: Deployment (40h)</span>
                <span>Wk 6: Midterm (240h)</span>
                <span className="font-bold text-primary">Wk 12: Certified (486h)</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Attendance Verification Rate */}
          <div className="p-7 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-ink">Daily Attendance & Verification Rate</div>
                <div className="font-mono text-xs text-[#087a55] font-semibold mt-0.5">
                  18/18 ACTIVE STUDENTS • 99.4% SAME-DAY APPROVALS
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-success-tint text-success-text border border-success-border">
                STATUS: NOMINAL
              </span>
            </div>

            {/* Glowing Teal SVG Curve Chart */}
            <div className="relative pt-4">
              <svg viewBox="0 0 520 180" className="w-full h-44 overflow-visible">
                <defs>
                  <linearGradient id="tealGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#087a55" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="#087a55" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#087a55" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="tealLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#087a55" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                <line x1="20" y1="30" x2="500" y2="30" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="80" x2="500" y2="80" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="130" x2="500" y2="130" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Area Gradient Fill */}
                <path
                  d="M 25 140 C 120 130, 200 90, 310 65 C 400 45, 460 30, 495 28 L 495 160 L 25 160 Z"
                  fill="url(#tealGlow)"
                />

                {/* Main Glowing Trajectory Curve */}
                <path
                  d="M 25 140 C 120 130, 200 90, 310 65 C 400 45, 460 30, 495 28"
                  fill="none"
                  stroke="url(#tealLineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="filter drop-shadow-[0_0_8px_rgba(8,122,85,0.45)]"
                />

                {/* Data Points */}
                {[
                  { cx: 25, cy: 140 },
                  { cx: 150, cy: 115 },
                  { cx: 270, cy: 80 },
                  { cx: 390, cy: 45 },
                  { cx: 495, cy: 28 },
                ].map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.cx} cy={pt.cy} r="5" fill="#ffffff" stroke="#087a55" strokeWidth="2.5" />
                    <circle cx={pt.cx} cy={pt.cy} r="9" fill="#087a55" fillOpacity="0.15" />
                  </g>
                ))}
              </svg>

              {/* Bottom Labels */}
              <div className="flex items-center justify-between text-[11px] font-mono text-copy-muted uppercase pt-2">
                <span>Initial Onboarding</span>
                <span>Mid-Semester Review</span>
                <span className="font-bold text-success">Target Completed (100%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

