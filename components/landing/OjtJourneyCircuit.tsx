'use client';

import React, { useState } from 'react';
import { 
  GraduationCap, 
  FileText, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Award, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // CORTEX-INSPIRED 6-STEP PRACTICUM JOURNEY CIRCUIT
 *
 * Modeled directly on Neil's Cortex Core architecture:
 *   - Central Glowing Core Node ("PRACTICUM ENGINE // DUGTONG CORE")
 *   - Branching circuit traces with animated pulse nodes & SVG path streams
 *   - Broken, staggered spatial layout with overlapping floating panels
 *   - Rich contextual sub-tags (plain markdown / technical pill aesthetics)
 *   - Strictly OJT context: Apply -> Accept -> Log -> Approve -> Evaluate -> Certify
 * ───────────────────────────────────────────────────────────────────────────── */

interface JourneyPhase {
  stepNum: string;
  phaseId: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  icon: React.ElementType;
  accent: 'blue' | 'teal' | 'emerald';
  stratum: '01' | '02' | '03';
}

const JOURNEY_STEPS: JourneyPhase[] = [
  {
    stepNum: '01',
    phaseId: 'PHASE 01 // ENTRANCE',
    title: 'Apply & Match',
    subtitle: 'Verified partner company listings',
    description: 'Students upload an accredited resume and apply directly to CITE-approved industry listings matching their specialization.',
    tags: ['RESUME.PDF', 'PARTNER-LISTINGS', 'COURSE-MATCH', 'PORTFOLIO-LINK'],
    icon: FileText,
    accent: 'blue',
    stratum: '01',
  },
  {
    stepNum: '02',
    phaseId: 'PHASE 02 // ONBOARDING',
    title: 'Get Accepted',
    subtitle: 'Immediate supervisor deployment',
    description: 'The partner company supervisor accepts the student applicant. The digital training contract and quota are locked into the system.',
    tags: ['DEPLOYMENT-CONTRACT', 'SUPERVISOR-ASSIGNED', '300H-QUOTA-SEEDED'],
    icon: Building2,
    accent: 'blue',
    stratum: '01',
  },
  {
    stepNum: '03',
    phaseId: 'PHASE 03 // TELEMETRY',
    title: 'Log Daily Shifts',
    subtitle: 'Authoritative server timestamps',
    description: 'One-tap Time In and Time Out recorded server-side in Asia/Manila. Net shift duration computed automatically with 1-hour lunch break deduction.',
    tags: ['ASIA/MANILA-CLOCK', 'GEO-STAMP', 'DAILY-JOURNAL-MIN30W', 'IMMUTABLE-ENTRY'],
    icon: Clock,
    accent: 'teal',
    stratum: '02',
  },
  {
    stepNum: '04',
    phaseId: 'PHASE 04 // VERIFICATION',
    title: 'Same-Day Signoff',
    subtitle: 'Zero end-of-semester backlogs',
    description: 'Supervisors review journals and approve shifts in bulk. Approved entries are cryptographically locked; adjustments require an audit reason.',
    tags: ['BULK-APPROVAL-QUEUE', 'AUDIT-LOG', 'HOURS-CHAIN-INCREMENT', 'ZERO-TAMPERING'],
    icon: CheckCircle2,
    accent: 'teal',
    stratum: '02',
  },
  {
    stepNum: '05',
    phaseId: 'PHASE 05 // RUBRIC',
    title: 'Supervisor Evaluation',
    subtitle: 'Practicum competency assessment',
    description: 'Upon crossing 300 approved hours, the supervisor submits the standardized performance evaluation across technical proficiency and teamwork.',
    tags: ['300H-TARGET-MET', 'COMPETENCY-RUBRIC', 'RATING-MATRIX', 'SUPERVISOR-SEAL'],
    icon: Sparkles,
    accent: 'emerald',
    stratum: '03',
  },
  {
    stepNum: '06',
    phaseId: 'PHASE 06 // CREDENTIAL',
    title: 'Get Certified',
    subtitle: 'Dean signoff & graduation clearance',
    description: 'Automated certification and official printable DTR sheets are generated with verified signatures. Ready for CITE graduation clearance.',
    tags: ['PDF-DTR-EXPORT', 'DEAN-VERIFIED', 'DPA-2012-COMPLIANT', 'GRAD-CLEARANCE'],
    icon: Award,
    accent: 'emerald',
    stratum: '03',
  },
];

const container = 'mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]';

export default function OjtJourneyCircuit() {
  const [activeStep, setActiveStep] = useState<string>('01');

  return (
    <section id="how-it-works" className="py-24 max-sm:py-16 border-b border-border bg-page-wash relative overflow-hidden">
      {/* Background Subtle Circuit Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(110, 147, 255, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className={cn(container, 'relative z-10')}>
        {/* Section Header */}
        <div className="space-y-3 max-w-[700px] mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 font-mono text-xs font-semibold text-primary">
            <Cpu className="size-3.5 text-primary" />
            <span>PRACTICUM ARCHITECTURE // 06 STAGES</span>
          </div>
          <h2 className="font-heading text-[clamp(32px,3.8vw,48px)] font-black leading-[1.1] tracking-[-0.03em] text-ink">
            One connected journey,{' '}
            <span className="text-primary italic font-serif font-normal">
              zero lost hours.
            </span>
          </h2>
          <p className="text-base sm:text-lg leading-[1.65] text-copy-muted">
            From initial company application to final university certification. An interconnected, verified pipeline designed with Cortex spatial geometry.
          </p>
        </div>

        {/* ── CORTEX SPATIAL CIRCUIT LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── LEFT COLUMN: CENTRAL HUB NODE ("CORTEX CORE" EQUIVALENT) ── */}
          <div className="lg:col-span-4 sticky top-24 space-y-6">
            <div className="relative p-6 sm:p-8 rounded-3xl border border-border bg-card/90 backdrop-blur-md shadow-lg overflow-hidden flex flex-col items-center text-center">
              
              {/* Central Glowing Orb Node */}
              <div className="relative my-4 flex items-center justify-center">
                {/* Outer Glowing Rings */}
                <div className="absolute size-36 rounded-full border border-primary/30 animate-ping opacity-25" />
                <div className="absolute size-28 rounded-full border-2 border-primary/60 shadow-[0_0_35px_rgba(34,85,242,0.4)]" />
                
                {/* Core Gradient Button */}
                <div className="relative size-20 rounded-full bg-gradient-to-tr from-[#2255f2] via-[#3b82f6] to-[#2dd4bf] flex items-center justify-center text-white shadow-[0_0_25px_rgba(34,85,242,0.6)]">
                  <GraduationCap className="size-9 stroke-[2.2]" />
                </div>
              </div>

              {/* Core Label */}
              <div className="mt-3 space-y-1">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                  DUGTONG CORE
                </span>
                <h3 className="font-heading text-lg font-bold text-ink">
                  Practicum Verification Hub
                </h3>
                <p className="text-xs text-copy-muted max-w-[240px] leading-relaxed">
                  Real-time pipeline governing student hours, daily journals, and supervisor signoffs.
                </p>
              </div>

              {/* Status Indicators */}
              <div className="mt-6 pt-4 border-t border-border w-full flex items-center justify-between text-[11px] font-mono text-copy-muted">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  <span className="text-ink font-semibold">ONLINE</span>
                </div>
                <span>100% DETERMINISTIC</span>
              </div>
            </div>

            {/* Quick Stratum Nav */}
            <div className="p-4 rounded-2xl border border-border bg-surface/70 space-y-2 text-xs font-mono">
              <div className="text-[11px] text-copy-muted uppercase font-bold px-2">Pipeline Strata</div>
              <div className="space-y-1.5">
                <div className="p-2 rounded-xl bg-card border border-border flex items-center justify-between text-ink">
                  <span>STRATUM 01 // Placement</span>
                  <span className="text-primary font-bold">Steps 01-02</span>
                </div>
                <div className="p-2 rounded-xl bg-card border border-border flex items-center justify-between text-ink">
                  <span>STRATUM 02 // Daily Shifts</span>
                  <span className="text-teal font-bold">Steps 03-04</span>
                </div>
                <div className="p-2 rounded-xl bg-card border border-border flex items-center justify-between text-ink">
                  <span>STRATUM 03 // Certification</span>
                  <span className="text-success font-bold">Steps 05-06</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: STAGGERED, BROKEN-GRID BRANCHING CARDS ── */}
          <div className="lg:col-span-8 space-y-6 relative">
            
            {/* Background SVG Neural Connector Line */}
            <div className="hidden lg:block absolute left-[-24px] top-8 bottom-8 w-6 pointer-events-none">
              <svg className="h-full w-full" preserveAspectRatio="none">
                <line 
                  x1="0" 
                  y1="10%" 
                  x2="24" 
                  y2="10%" 
                  stroke="rgba(110, 147, 255, 0.4)" 
                  strokeWidth="2" 
                />
                <line 
                  x1="0" 
                  y1="45%" 
                  x2="24" 
                  y2="45%" 
                  stroke="rgba(45, 212, 191, 0.4)" 
                  strokeWidth="2" 
                />
                <line 
                  x1="0" 
                  y1="85%" 
                  x2="24" 
                  y2="85%" 
                  stroke="rgba(16, 185, 129, 0.4)" 
                  strokeWidth="2" 
                />
                <line 
                  x1="24" 
                  y1="10%" 
                  x2="24" 
                  y2="85%" 
                  stroke="rgba(110, 147, 255, 0.25)" 
                  strokeWidth="2"
                  strokeDasharray="4 4" 
                />
              </svg>
            </div>

            {/* 6 Steps Staggered in 3 Strata */}
            {JOURNEY_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isSelected = activeStep === step.stepNum;
              
              // Cortex Broken Grid: Alternating offsets
              const isEven = idx % 2 === 1;
              const offsetClass = isEven ? 'lg:translate-x-3' : 'lg:translate-x-0';

              return (
                <div
                  key={step.stepNum}
                  onClick={() => setActiveStep(step.stepNum)}
                  className={cn(
                    'p-6 sm:p-7 rounded-2xl border transition-all duration-300 shadow-sm cursor-pointer relative overflow-hidden backdrop-blur-md',
                    offsetClass,
                    isSelected
                      ? 'border-primary/60 bg-card shadow-[0_8px_30px_rgba(34,85,242,0.12)] ring-1 ring-primary/40'
                      : 'border-border bg-card/80 hover:border-primary/40 hover:bg-card'
                  )}
                >
                  {/* Subtle top indicator bar */}
                  <div className={cn(
                    'absolute top-0 left-0 right-0 h-1 transition-all',
                    isSelected 
                      ? step.accent === 'emerald' ? 'bg-success' : step.accent === 'teal' ? 'bg-teal-bright' : 'bg-primary'
                      : 'bg-transparent'
                  )} />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    
                    {/* Left Icon & Heading */}
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'size-12 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                        step.accent === 'emerald'
                          ? 'border-success-border bg-success-tint text-success-text'
                          : step.accent === 'teal'
                            ? 'border-teal-border bg-teal-tint text-teal-text'
                            : 'border-info-border bg-info-tint text-info-text'
                      )}>
                        <Icon className="size-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {step.phaseId}
                          </span>
                          <span className="text-border-strong">•</span>
                          <span className="text-[11px] font-mono text-copy-muted">
                            {step.subtitle}
                          </span>
                        </div>

                        <h4 className="font-heading text-xl font-black text-ink">
                          {step.stepNum}. {step.title}
                        </h4>

                        <p className="text-sm leading-relaxed text-copy-muted max-w-xl pt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {/* Step Numeric Monogram */}
                    <span className="font-mono text-2xl font-black text-border-strong/60 self-start sm:self-auto tabular-nums">
                      {step.stepNum}
                    </span>
                  </div>

                  {/* Cortex-Style Technical Sub-Tags (Plain Markdown / Heuristics Style) */}
                  <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-2">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md bg-surface border border-border-strong/70 font-mono text-[10px] font-semibold text-copy-muted hover:text-ink transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
