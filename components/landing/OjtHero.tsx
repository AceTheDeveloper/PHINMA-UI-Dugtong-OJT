'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Clock, 
  MapPin, 
  Shield, 
  Sparkles, 
  Award, 
  Wifi, 
  BatteryMedium,
  Check
} from 'lucide-react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // ARCHITECTURAL BENTO HERO + INTERACTIVE DEVICE
 *
 * Designed from Neil's Portfolio & Cortex Aesthetic:
 *   - Top System Status HUD Pill
 *   - Left Bento Panel: High-impact editorial headline + metadata tags
 *   - Right Panel: Sleek, welcoming interactive device (Smartphone / Mini-App)
 *     with mathematically centered dot grid, dynamic Time In/Out toggle,
 *     signature boxed Approved Hours with Hours Chain, and supervisor approvals.
 *   - Bottom: Smooth, continuous infinite marquee ticker (no scrollbars).
 * ───────────────────────────────────────────────────────────────────────────── */

const container = 'mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]';

const partnerCompanies = [
  'Western Visayas Tech Partners Inc.',
  'Iloilo Digital Innovations Hub',
  'Panay Cloud Solutions Corp.',
  'Metro Iloilo Dev Labs',
  'CITE Software Engineering Cell',
  'Panay Telecom Networks',
  'Visayas Applied AI Consortium',
  'Iloilo FinTech Systems',
];

export default function OjtHero() {
  const approvedHours = 212.0;
  const requiredHours = 300.0;
  const percentage = Math.round((approvedHours / requiredHours) * 1000) / 10;

  // Interactive device state
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [todayJournal] = useState('Fixed the login redirect and reviewed two pull requests.');
  const [approvedStudents, setApprovedStudents] = useState<Record<string, boolean>>({});

  const pendingQueue = [
    { id: 'ana', name: 'Ana S.', hours: '8.0 h', role: 'Frontend Dev' },
    { id: 'ben', name: 'Ben M.', hours: '7.5 h', role: 'QA Analyst' },
    { id: 'cara', name: 'Cara D.', hours: '8.0 h', role: 'Full Stack' },
  ];

  const pendingCount = pendingQueue.filter((item) => !approvedStudents[item.id]).length;

  const handleToggleClock = () => {
    setIsClockedIn((prev) => !prev);
  };

  const handleApproveStudent = (id: string) => {
    setApprovedStudents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApproveAll = () => {
    const allApproved: Record<string, boolean> = {};
    pendingQueue.forEach((item) => {
      allApproved[item.id] = true;
    });
    setApprovedStudents(allApproved);
  };

  return (
    <section className="border-b border-border bg-page-wash pt-8 pb-16">
      <div className={container}>
        {/* ── TOP SYSTEM HUD STRIP ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-border/80 text-[11px] font-mono text-copy-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            <span className="font-bold text-ink">PHINMA UI CITE // PRACTICUM PORTAL</span>
            <span className="text-border-strong">•</span>
            <span className="text-primary font-semibold">ASIA/MANILA SERVER VERIFIED</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline">BSIT PRACTICUM COHORT 2026</span>
            <span className="hidden md:inline text-border-strong">•</span>
            <span className="inline-flex items-center gap-1 text-primary">
              <Shield className="size-3" />
              <span>DPA 2012 COMPLIANT</span>
            </span>
          </div>
        </div>

        {/* ── BENTO HERO GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-start">
          {/* ── LEFT / MAIN BENTO HERO PANEL (7 Cols) ── */}
          <div className="lg:col-span-7 p-8 sm:p-10 rounded-3xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 font-mono text-xs font-semibold text-primary">
                <Sparkles className="size-3 text-primary" />
                <span>PRACTICUM OPERATIONS // BSIT // CITE</span>
              </div>

              {/* Main Headline (Editorial Polish) */}
              <h1 className="font-heading text-[clamp(38px,4.5vw,58px)] font-black leading-[1.05] tracking-[-0.04em] text-ink">
                Your OJT, from application to{' '}
                <span className="text-primary italic font-serif font-normal">
                  certification.
                </span>
              </h1>

              {/* Clear Subtitle */}
              <p className="text-base sm:text-lg leading-[1.65] text-copy-muted max-w-[540px]">
                Apply to accredited partner companies, record daily shifts with server-side time in and time out, submit daily journals, and earn verified graduation credentials. Zero lost paperwork, zero delayed signatures.
              </p>
            </div>

            {/* CTAs & Navigation */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-3.5">
                <Link
                  href="/dashboard"
                  className={cn(
                    'h-12 px-6 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer',
                    focusStyle
                  )}
                >
                  <span>Launch Student Portal</span>
                  <ArrowRight className="size-4" />
                </Link>

                <a
                  href="#ojt-portal-preview"
                  className={cn(
                    'h-12 px-5 rounded-xl border border-border hover:bg-surface text-ink text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer',
                    focusStyle
                  )}
                >
                  <span>Explore Interactive DTR</span>
                </a>
              </div>

              <div className="text-xs text-faint">
                Accounts are managed by CITE administration • Sign-in is invitation-only.
              </div>
            </div>

            {/* Sub-Bento Info Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-border">
              <div className="p-3.5 rounded-xl bg-surface border border-border flex items-start gap-3">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono text-copy-muted uppercase">Base Location</div>
                  <div className="text-xs font-bold text-ink mt-0.5">PHINMA University of Iloilo</div>
                  <div className="text-[10px] text-copy-muted font-mono">10.7202° N, 122.5621° E</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border flex items-start gap-3">
                <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono text-copy-muted uppercase">Practicum Quota</div>
                  <div className="text-xs font-bold text-ink mt-0.5">300.0 Hours Required</div>
                  <div className="text-[10px] text-primary font-mono font-semibold">1 link = 30 hours</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: INTERACTIVE MOBILE PHONE / MINI-APP FRAME (5 Cols) ── */}
          <div className="lg:col-span-5 relative flex justify-center w-full">
            {/* Phone Outer Chassis with Ambient Blue/Cyan Glow */}
            <div className="relative w-full max-w-[420px] rounded-[40px] p-3 sm:p-4 bg-gradient-to-b from-[#1c2c52] via-[#0f1b36] to-[#0a1224] border-2 border-border-strong/90 shadow-[0_20px_50px_rgba(8,18,42,0.45),0_0_30px_rgba(34,85,242,0.15)] transition-all">
              
              {/* Phone Inner Bezel & Screen Container */}
              <div className="relative rounded-[32px] overflow-hidden border border-border/80 bg-card/95 backdrop-blur-md">
                
                {/* Mathematical Precision Dot Grid Background */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-60"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(110, 147, 255, 0.35) 1.5px, transparent 1.5px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '10px 10px',
                  }}
                />

                {/* Top Phone Speaker / Notch */}
                <div className="relative z-10 pt-3 pb-2 px-6 flex items-center justify-between border-b border-border/50 text-[10px] font-mono text-copy-muted bg-surface/40">
                  <span className="font-bold text-ink tracking-tight">08:02</span>
                  
                  {/* Dynamic Island / Speaker Pill */}
                  <div className="h-4 w-20 rounded-full bg-ink/20 dark:bg-black/60 flex items-center justify-center">
                    <span className="size-1.5 rounded-full bg-primary/80 animate-ping mr-1" />
                    <span className="size-1.5 rounded-full bg-success" />
                  </div>

                  <div className="flex items-center gap-1.5 text-ink">
                    <Wifi className="size-3" />
                    <BatteryMedium className="size-3.5" />
                  </div>
                </div>

                {/* Mini-App Content Area */}
                <div className="relative z-10 p-4 sm:p-5 space-y-4">
                  
                  {/* Card 1: Today Time-In/Out (Live Interactive Toggle) */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-4 shadow-xs backdrop-blur-xs transition-all">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold font-mono uppercase text-copy-muted">Today</span>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all',
                        isClockedIn 
                          ? 'border-success-border bg-success-tint text-success-text' 
                          : 'border-border bg-surface text-copy-muted'
                      )}>
                        <span className={cn(
                          'size-1.5 rounded-full',
                          isClockedIn ? 'bg-success animate-pulse' : 'bg-disabled'
                        )} />
                        {isClockedIn ? 'Clocked in' : 'Off shift'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-black text-ink tracking-tight tabular-nums">
                        {isClockedIn ? '08:02' : '--:--'}
                      </span>
                      <span className="text-xs text-copy-muted">
                        {isClockedIn ? 'AM, time in' : 'Ready to clock in'}
                      </span>
                    </div>

                    {isClockedIn && (
                      <div className="mt-2.5 rounded-xl bg-card dark:bg-surface/80 border border-border/80 px-3 py-2 text-xs text-copy-muted leading-relaxed">
                        {todayJournal}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleClock}
                      className={cn(
                        'mt-3.5 w-full h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs',
                        isClockedIn 
                          ? 'bg-primary hover:bg-primary-hover text-primary-foreground' 
                          : 'bg-success hover:bg-success-hover text-white'
                      )}
                    >
                      <span>{isClockedIn ? 'Time out' : 'Time in now'}</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>

                  {/* Card 2: Boxed Approved Hours with Hours Chain */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-4 shadow-xs backdrop-blur-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold font-mono uppercase text-copy-muted">Approved hours</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success-text">
                        <Check className="size-3" />
                        <span>On track</span>
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-black text-ink tracking-tight tabular-nums">
                        212
                      </span>
                      <span className="font-mono text-sm font-semibold text-copy-muted tabular-nums">
                        / 300 h
                      </span>
                    </div>

                    {/* Signature Hours Chain Visualizer */}
                    <div className="my-3 py-1">
                      <HoursChain approvedHours={approvedHours} requiredHours={requiredHours} size="sm" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-copy-muted font-medium">
                      <span>Progress: {percentage}%</span>
                      <span className="text-primary font-bold">88 hours to go</span>
                    </div>
                  </div>

                  {/* Card 3: Supervisor Pending Approval Strip */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-4 shadow-xs backdrop-blur-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono uppercase text-copy-muted">Supervisor Review</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        pendingCount > 0 
                          ? 'border-warning-border bg-warning-tint text-warning-text' 
                          : 'border-success-border bg-success-tint text-success-text'
                      )}>
                        {pendingCount > 0 ? `${pendingCount} pending` : 'All signed'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {pendingQueue.map((student) => {
                        const isApproved = approvedStudents[student.id];
                        return (
                          <div 
                            key={student.id} 
                            onClick={() => handleApproveStudent(student.id)}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-xl border text-xs transition-all cursor-pointer',
                              isApproved 
                                ? 'bg-success-tint/40 border-success-border/60 text-success-text' 
                                : 'bg-card dark:bg-surface/60 border-border text-ink hover:border-primary/50'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'size-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                                isApproved ? 'bg-success text-white' : 'bg-surface border border-border text-copy-muted'
                              )}>
                                {isApproved ? <Check className="size-3" /> : student.name.charAt(0)}
                              </span>
                              <span className="font-semibold">{student.name}</span>
                              <span className="text-[10px] text-copy-muted hidden sm:inline">({student.role})</span>
                            </div>

                            <span className="font-mono font-bold tabular-nums">
                              {student.hours}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={handleApproveAll}
                        className="w-full h-8 rounded-xl border border-border-strong hover:bg-surface text-ink text-xs font-bold transition-colors cursor-pointer"
                      >
                        Approve all {pendingCount} shifts
                      </button>
                    )}
                  </div>

                  {/* Card 4: Certification Preview Card */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-3.5 shadow-xs flex items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal-text">
                      <Award className="size-5" />
                    </span>
                    <div>
                      <div className="font-heading text-xs font-bold text-ink">Practicum Certification</div>
                      <div className="text-[11px] text-copy-muted">Issued automatically once 300 hrs are approved.</div>
                    </div>
                  </div>

                </div>

                {/* Bottom Home Indicator Bar */}
                <div className="relative z-10 pb-3 pt-1 flex justify-center bg-surface/40">
                  <div className="h-1 w-28 rounded-full bg-border-strong" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTINUOUS PARTNER MARQUEE TICKER (Smooth Infinite Stream) ── */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row md:items-center gap-4 text-xs font-mono text-copy-muted overflow-hidden">
          <div className="shrink-0 font-bold uppercase text-ink flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Accredited Industry Partners:</span>
          </div>

          {/* Infinite Marquee Track with Dual Streams and Left/Right Mask */}
          <div 
            className="relative flex-1 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
            }}
          >
            <div className="animate-marquee whitespace-nowrap flex items-center gap-8 py-1 select-none">
              {/* Track 1 */}
              {partnerCompanies.map((company, i) => (
                <React.Fragment key={`p1-${i}`}>
                  <span className="text-[11px] font-medium text-copy-muted hover:text-primary transition-colors cursor-default">
                    {company}
                  </span>
                  <span className="text-border-strong">•</span>
                </React.Fragment>
              ))}

              {/* Track 2 (Duplicate for Seamless Loop) */}
              {partnerCompanies.map((company, i) => (
                <React.Fragment key={`p2-${i}`}>
                  <span className="text-[11px] font-medium text-copy-muted hover:text-primary transition-colors cursor-default">
                    {company}
                  </span>
                  <span className="text-border-strong">•</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
