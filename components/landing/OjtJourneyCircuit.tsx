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
  Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // REFACTORED 6-STEP PRACTICUM JOURNEY ARCHITECTURE
 *
 * Mobile Overhaul:
 *   - Compact horizontal stepper strip on mobile (hides large bulky sidebar)
 *   - Full sticky architecture hub on desktop (lg:)
 *   - Tighter padding (pl-6 on mobile vs pl-10 on desktop) saving horizontal space
 *   - Proportional badge sizes (text-[9px] on mobile)
 *   - Continuous vertical line spanning top-0 to bottom-0 with zero overhang
 * ───────────────────────────────────────────────────────────────────────────── */

interface JourneyPhase {
  stepNum: string;
  phaseId: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  icon: React.ElementType;
}

const JOURNEY_STEPS: JourneyPhase[] = [
  {
    stepNum: '01',
    phaseId: 'PHASE 01 // ENTRANCE',
    title: 'Apply & Match',
    subtitle: 'Verified partner company listings',
    description: 'Students upload an accredited resume and apply directly to CITE-approved industry listings matching their course specialization.',
    tags: ['RESUME.PDF', 'PARTNER-LISTINGS', 'COURSE-MATCH', 'PORTFOLIO-LINK'],
    icon: FileText,
  },
  {
    stepNum: '02',
    phaseId: 'PHASE 02 // ONBOARDING',
    title: 'Get Accepted',
    subtitle: 'Immediate supervisor deployment',
    description: 'The partner company supervisor accepts the student applicant. The digital training contract and quota are locked into the system.',
    tags: ['DEPLOYMENT-CONTRACT', 'SUPERVISOR-ASSIGNED', '300H-QUOTA-SEEDED'],
    icon: Building2,
  },
  {
    stepNum: '03',
    phaseId: 'PHASE 03 // TELEMETRY',
    title: 'Log Daily Shifts',
    subtitle: 'Authoritative server timestamps',
    description: 'One-tap Time In and Time Out recorded server-side in Asia/Manila. Net shift duration computed automatically with 1-hour lunch break deduction.',
    tags: ['ASIA/MANILA-CLOCK', 'GEO-STAMP', 'DAILY-JOURNAL-MIN30W', 'IMMUTABLE-ENTRY'],
    icon: Clock,
  },
  {
    stepNum: '04',
    phaseId: 'PHASE 04 // VERIFICATION',
    title: 'Same-Day Signoff',
    subtitle: 'Zero end-of-semester backlogs',
    description: 'Supervisors review journals and approve shifts in bulk. Approved entries are cryptographically locked; adjustments require an audit reason.',
    tags: ['BULK-APPROVAL-QUEUE', 'AUDIT-LOG', 'HOURS-CHAIN-INCREMENT', 'ZERO-TAMPERING'],
    icon: CheckCircle2,
  },
  {
    stepNum: '05',
    phaseId: 'PHASE 05 // RUBRIC',
    title: 'Supervisor Evaluation',
    subtitle: 'Practicum competency assessment',
    description: 'Upon crossing 300 approved hours, the supervisor submits the standardized performance evaluation across technical proficiency and teamwork.',
    tags: ['300H-TARGET-MET', 'COMPETENCY-RUBRIC', 'RATING-MATRIX', 'SUPERVISOR-SEAL'],
    icon: Sparkles,
  },
  {
    stepNum: '06',
    phaseId: 'PHASE 06 // CREDENTIAL',
    title: 'Get Certified',
    subtitle: 'Dean signoff & graduation clearance',
    description: 'Automated certification and official printable DTR sheets are generated with verified signatures. Ready for CITE graduation clearance.',
    tags: ['PDF-DTR-EXPORT', 'DEAN-VERIFIED', 'DPA-2012-COMPLIANT', 'GRAD-CLEARANCE'],
    icon: Award,
  },
];

const container = 'mx-auto w-[min(100%_-_40px,1200px)] sm:w-[min(100%_-_64px,1200px)]';

export default function OjtJourneyCircuit() {
  const [activeStep, setActiveStep] = useState<string>('01');

  return (
    <section id="how-it-works" className="py-12 sm:py-16 border-b border-border bg-page-wash relative">
      <div className={container}>
        
        {/* Section Header */}
        <div className="space-y-3 max-w-[720px] mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 font-mono text-[11px] sm:text-xs font-semibold text-primary">
            <Cpu className="size-3.5 text-primary" />
            <span>PRACTICUM ARCHITECTURE // 06 PHASES</span>
          </div>
          <h2 className="font-heading text-[clamp(28px,6vw,46px)] font-black leading-[1.1] tracking-[-0.03em] text-ink">
            One connected journey,{' '}
            <span className="text-primary italic font-serif font-normal">
              zero lost hours.
            </span>
          </h2>
          <p className="text-sm sm:text-base leading-[1.6] text-copy-muted">
            From initial partner company application to final university certification. A deterministic verification pipeline built for students and supervisors.
          </p>
        </div>

        {/* ── MOBILE COMPACT STATUS BAR & STEPPER (< lg) ── */}
        <div className="block lg:hidden mb-6 p-3 rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-[#0f172a] shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-border/80">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <GraduationCap className="size-4 text-primary" />
              <span>DUGTONG CORE</span>
            </span>
            <span className="text-[10px] text-success font-semibold flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              ONLINE • ASIA/MANILA
            </span>
          </div>

          {/* Quick Step Jump Tabs */}
          <div className="grid grid-cols-6 gap-1.5 pt-2">
            {JOURNEY_STEPS.map((s) => (
              <button
                key={s.stepNum}
                type="button"
                onClick={() => setActiveStep(s.stepNum)}
                className={cn(
                  'py-1.5 rounded-lg text-center font-mono text-[11px] font-bold transition-all cursor-pointer',
                  activeStep === s.stepNum
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-surface dark:bg-slate-800/80 text-copy-muted hover:text-ink'
                )}
              >
                {s.stepNum}
              </button>
            ))}
          </div>
        </div>

        {/* ── STRICT CSS GRID: LEFT SIDEBAR (4 Cols) + RIGHT CARDS (8 Cols) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── DESKTOP SIDEBAR: CORE HUB + STRATA (Hidden on mobile, sticky on lg:) ── */}
          <div className="hidden lg:block lg:col-span-4 sticky top-12 self-start space-y-4">
            
            {/* Core Hub Box */}
            <div className="p-6 rounded-2xl border border-border dark:border-slate-700 bg-card dark:bg-[#0f172a] shadow-xs flex flex-col items-center text-center">
              
              {/* Central Glowing Node (Solid Flat Primary) */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="absolute size-24 rounded-full border border-primary/40 animate-ping opacity-30" />
                <div className="absolute size-20 rounded-full border-2 border-primary/60 shadow-[0_0_20px_rgba(34,85,242,0.3)]" />
                
                <div className="relative size-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                  <GraduationCap className="size-7 stroke-[2.2]" />
                </div>
              </div>

              {/* Core Titles */}
              <div className="mt-2 space-y-1">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
                  DUGTONG CORE
                </span>
                <h3 className="font-heading text-base font-bold text-ink">
                  Practicum Verification Hub
                </h3>
                <p className="text-xs text-copy-muted max-w-[240px] leading-relaxed">
                  Deterministic pipeline governing hours, daily journals, and supervisor signoffs.
                </p>
              </div>

              {/* Status Footer */}
              <div className="mt-5 pt-3.5 border-t border-border dark:border-slate-800 w-full flex items-center justify-between text-[11px] font-mono text-copy-muted">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  <span className="text-ink font-semibold">ONLINE</span>
                </div>
                <span>ASIA/MANILA</span>
              </div>
            </div>

            {/* Pipeline Strata Reference */}
            <div className="p-4 rounded-xl border border-border dark:border-slate-800 bg-surface/50 dark:bg-[#0b1120] space-y-2 text-xs font-mono">
              <div className="text-[10px] text-copy-muted uppercase font-bold tracking-wider px-1">
                Pipeline Strata
              </div>
              <div className="space-y-1.5">
                <div className="p-2 rounded-lg bg-card dark:bg-[#0f172a] border border-border dark:border-slate-800 flex items-center justify-between text-ink">
                  <span>STRATUM 01 // Placement</span>
                  <span className="text-primary font-bold">Steps 01–02</span>
                </div>
                <div className="p-2 rounded-lg bg-card dark:bg-[#0f172a] border border-border dark:border-slate-800 flex items-center justify-between text-ink">
                  <span>STRATUM 02 // Daily Shifts</span>
                  <span className="text-teal font-bold">Steps 03–04</span>
                </div>
                <div className="p-2 rounded-lg bg-card dark:bg-[#0f172a] border border-border dark:border-slate-800 flex items-center justify-between text-ink">
                  <span>STRATUM 03 // Certification</span>
                  <span className="text-success font-bold">Steps 05–06</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: UNBROKEN CONTINUOUS VERTICAL LINE + 6 RIGID CARDS ── */}
          <div className="lg:col-span-8 relative flex flex-col gap-4 sm:gap-5 pl-7 sm:pl-10">
            
            {/* ── CONTINUOUS UNBROKEN LINE: Top-0 to Bottom-0 (No Cuts) ── */}
            <div 
              aria-hidden="true"
              className="absolute left-[11px] sm:left-[15px] top-0 bottom-0 w-[2px] bg-slate-300 dark:bg-slate-700 pointer-events-none z-0" 
            />

            {/* 6 Rigid Cards */}
            {JOURNEY_STEPS.map((step) => {
              const Icon = step.icon;
              const isSelected = activeStep === step.stepNum;

              return (
                <div
                  key={step.stepNum}
                  onClick={() => setActiveStep(step.stepNum)}
                  className={cn(
                    'relative p-4 sm:p-5 lg:p-6 rounded-xl border transition-all duration-200 cursor-pointer select-none z-10',
                    'bg-card dark:bg-[#0f172a]',
                    isSelected
                      ? 'border-primary dark:border-blue-500/70 ring-1 ring-primary/40 shadow-xs'
                      : 'border-border dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-600'
                  )}
                >
                  {/* Horizontal Connector Stub: Exact pixel alignment without overshooting */}
                  <div 
                    aria-hidden="true"
                    className={cn(
                      'absolute -left-[17px] sm:-left-[25px] top-[34px] sm:top-[40px] -translate-y-1/2 w-[17px] sm:w-[25px] h-[2px] transition-colors z-0',
                      isSelected ? 'bg-primary dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  />
                  
                  {/* Node Dot: Exactly centered on the vertical line */}
                  <div 
                    aria-hidden="true"
                    className={cn(
                      'absolute -left-[23px] sm:-left-[31px] top-[34px] sm:top-[40px] -translate-y-1/2 size-3 rounded-full border-2 transition-all z-10',
                      isSelected 
                        ? 'border-primary bg-primary shadow-[0_0_8px_rgba(59,130,246,0.9)]' 
                        : 'border-slate-400 dark:border-slate-600 bg-page-wash dark:bg-[#0b1120]'
                    )}
                  />

                  {/* Card Content Header */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 sm:gap-3.5">
                      {/* Step Icon */}
                      <div className={cn(
                        'size-9 sm:size-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                        isSelected
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border dark:border-slate-700 bg-surface dark:bg-slate-800/80 text-copy-muted'
                      )}>
                        <Icon className="size-4 sm:size-5" />
                      </div>

                      {/* Titles */}
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-mono text-[10px] sm:text-[11px] font-bold text-primary tracking-wide">
                            {step.phaseId}
                          </span>
                          <span className="text-border-strong hidden sm:inline">•</span>
                          <span className="text-[10px] sm:text-[11px] font-mono text-copy-muted">
                            {step.subtitle}
                          </span>
                        </div>

                        <h4 className="font-heading text-base sm:text-lg font-bold text-ink">
                          {step.stepNum}. {step.title}
                        </h4>

                        <p className="text-xs sm:text-sm leading-relaxed text-copy-muted pt-0.5 max-w-xl">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {/* Numeric Monogram */}
                    <span className="font-mono text-base sm:text-xl font-bold text-copy-muted/40 tabular-nums self-start shrink-0">
                      {step.stepNum}
                    </span>
                  </div>

                  {/* Flat Rigid Technical Badges (Compact on mobile) */}
                  <div className="mt-3.5 pt-3 border-t border-border dark:border-slate-800/80 flex flex-wrap gap-1.5 sm:gap-2">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border border-slate-300 dark:border-slate-700 bg-transparent text-copy-muted dark:text-slate-400 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm"
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
