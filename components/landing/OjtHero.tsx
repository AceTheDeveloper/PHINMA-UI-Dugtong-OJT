'use client';

import React, { useState, useEffect } from 'react';
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
  Check,
  CheckCircle2,
  Building2,
  RotateCw,
  LogOut,
  LogIn
} from 'lucide-react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // ARCHITECTURAL BENTO HERO + PROPORTIONAL INTERACTIVE DEVICE
 *
 * Designed from Neil's Portfolio & Cortex Aesthetic:
 *   - Top System Status HUD Strip (Asia/Manila Server Authoritative)
 *   - Left Bento Panel: High-impact editorial headline + metadata tags
 *   - Right Panel: Sleek, proportional Smartphone (9:19.5 aspect ratio)
 *     with ZERO dead space, live ticking server clock, stateful single
 *     Time In / Time Out toggle button with glowing color shifts,
 *     and looping data-sync animation on Approved Hours progress.
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

  // Real-time ticking clock for live server shift telemetry
  const [liveClock, setLiveClock] = useState('08:32:15 AM');
  const [liveSeconds, setLiveSeconds] = useState(15);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setLiveSeconds(now.getSeconds());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single stateful Toggle Switch state for Time In / Time Out
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [approvedStudents, setApprovedStudents] = useState<Record<string, boolean>>({});

  const pendingQueue = [
    { id: 'ana', name: 'Ana S.', hours: '8.0 h', role: 'Frontend' },
    { id: 'ben', name: 'Ben M.', hours: '7.5 h', role: 'QA Lead' },
    { id: 'cara', name: 'Cara D.', hours: '8.0 h', role: 'Full Stack' },
  ];

  const pendingCount = pendingQueue.filter((item) => !approvedStudents[item.id]).length;

  const handleToggleShift = () => {
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-stretch">
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
                  href="#how-it-works"
                  className={cn(
                    'h-12 px-5 rounded-xl border border-border hover:bg-surface text-ink text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer',
                    focusStyle
                  )}
                >
                  <span>View 6-Step Journey Map</span>
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

          {/* ── RIGHT PANEL: PROPORTIONAL SMARTPHONE MINI-APP (5 Cols) ── */}
          <div className="lg:col-span-5 flex justify-center items-center w-full">
            {/* Phone Chassis locked to sleek handheld proportions (No awkward dead space) */}
            <div className="relative w-full max-w-[390px] rounded-[38px] p-3 sm:p-3.5 bg-gradient-to-b from-[#1b2b4e] via-[#0e1933] to-[#081020] border border-border-strong/90 shadow-[0_20px_50px_rgba(8,18,42,0.45),0_0_30px_rgba(34,85,242,0.18)] transition-all flex flex-col">
              
              {/* Phone Inner Screen Glass */}
              <div className="relative rounded-[30px] overflow-hidden border border-border/80 bg-card/95 backdrop-blur-md flex flex-col justify-between">
                
                {/* Mathematical Precision Dot Grid Background */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-55"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(110, 147, 255, 0.35) 1.5px, transparent 1.5px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '10px 10px',
                  }}
                />

                {/* Top Phone Status Bar + Dynamic Island Speaker */}
                <div className="relative z-10 pt-2.5 pb-2 px-5 flex items-center justify-between border-b border-border/50 text-[10px] font-mono text-copy-muted bg-surface/50">
                  <span className="font-bold text-ink tracking-tight">08:02</span>
                  
                  {/* Dynamic Island Speaker */}
                  <div className="h-3.5 w-18 rounded-full bg-ink/20 dark:bg-black/70 flex items-center justify-center gap-1">
                    <span className="size-1 rounded-full bg-primary/80 animate-ping" />
                    <span className="size-1 rounded-full bg-success" />
                  </div>

                  <div className="flex items-center gap-1.5 text-ink">
                    <Wifi className="size-3" />
                    <BatteryMedium className="size-3.5" />
                  </div>
                </div>

                {/* Mini-App Content Stack (Compact, No Dead Gaps) */}
                <div className="relative z-10 p-4 space-y-3">
                  
                  {/* Card 1: Today Shift & Live Toggle Switch */}
                  <div className={cn(
                    'rounded-2xl border p-3.5 transition-all shadow-xs backdrop-blur-xs',
                    isClockedIn 
                      ? 'border-primary/40 bg-surface/90 shadow-[0_0_20px_rgba(34,85,242,0.08)]' 
                      : 'border-border bg-card/90'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold font-mono uppercase text-copy-muted">
                        Today Shift
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-all',
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

                    {/* Live Server Clock */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="font-mono text-2xl sm:text-3xl font-black text-ink tracking-tight tabular-nums">
                          {liveClock}
                        </div>
                        <div className="text-[10px] text-copy-muted font-mono mt-0.5">
                          {isClockedIn ? 'Server Time In: 08:00:00 AM' : 'Server Status: Standby'}
                        </div>
                      </div>
                    </div>

                    {/* Single Prominent Stateful Toggle Button (Crucial Requirement 1) */}
                    <button
                      type="button"
                      onClick={handleToggleShift}
                      className={cn(
                        'mt-3 w-full h-11 rounded-xl font-bold text-xs flex items-center justify-between px-4 transition-all duration-300 cursor-pointer shadow-md select-none relative overflow-hidden',
                        isClockedIn 
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)]' 
                          : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isClockedIn ? (
                          <LogOut className="size-4 text-white" />
                        ) : (
                          <LogIn className="size-4 text-white" />
                        )}
                        <span className="font-extrabold tracking-wide uppercase">
                          {isClockedIn ? 'Time Out Shift' : 'Time In Shift'}
                        </span>
                      </div>

                      {/* Toggle Visual Pill Switch */}
                      <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold">
                        <span>{isClockedIn ? 'CLICK TO END' : 'CLICK TO START'}</span>
                        <span className={cn(
                          'size-2 rounded-full',
                          isClockedIn ? 'bg-amber-300 animate-ping' : 'bg-emerald-300 animate-ping'
                        )} />
                      </div>
                    </button>
                  </div>

                  {/* Card 2: Boxed Approved Hours with Looping Loading Progress */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-3.5 shadow-xs backdrop-blur-xs relative overflow-hidden">
                    {/* Looping ambient data-sync shimmer line (Requirement 2) */}
                    <div className="animate-sync-shimmer" />

                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold font-mono uppercase text-copy-muted">Approved hours</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success-text">
                        <Check className="size-3" />
                        <span>On track</span>
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl sm:text-3xl font-black text-ink tracking-tight tabular-nums">
                        212
                      </span>
                      <span className="font-mono text-xs font-semibold text-copy-muted tabular-nums">
                        / 300 h
                      </span>
                      <span className="ml-auto text-[10px] font-mono text-primary font-semibold flex items-center gap-1">
                        <RotateCw className="size-2.5 animate-spin text-primary" />
                        <span>Live Sync</span>
                      </span>
                    </div>

                    {/* Signature Hours Chain Visualizer */}
                    <div className="my-2.5 py-0.5">
                      <HoursChain approvedHours={approvedHours} requiredHours={requiredHours} size="sm" />
                    </div>

                    {/* Looping Progress Bar (Infinitely looping loading sequence) */}
                    <div className="relative h-1.5 w-full rounded-full bg-border-strong/50 overflow-hidden mt-1">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-primary via-teal-bright to-primary transition-all duration-500 relative"
                        style={{ width: `${percentage}%` }}
                      >
                        <div className="absolute inset-0 bg-white/40 animate-pulse" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-copy-muted font-medium pt-1">
                      <span>Progress: {percentage}%</span>
                      <span className="text-primary font-bold">88 hours to go</span>
                    </div>
                  </div>

                  {/* Card 3: Supervisor Review Quick Queue */}
                  <div className="rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold font-mono uppercase text-copy-muted">Supervisor Review</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        pendingCount > 0 
                          ? 'border-warning-border bg-warning-tint text-warning-text' 
                          : 'border-success-border bg-success-tint text-success-text'
                      )}>
                        {pendingCount > 0 ? `${pendingCount} pending` : 'All signed'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {pendingQueue.map((student) => {
                        const isApproved = approvedStudents[student.id];
                        return (
                          <div 
                            key={student.id} 
                            onClick={() => handleApproveStudent(student.id)}
                            className={cn(
                              'flex items-center justify-between p-1.5 px-2.5 rounded-xl border text-[11px] transition-all cursor-pointer',
                              isApproved 
                                ? 'bg-success-tint/40 border-success-border/60 text-success-text' 
                                : 'bg-card dark:bg-surface/60 border-border text-ink hover:border-primary/50'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'size-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                                isApproved ? 'bg-success text-white' : 'bg-surface border border-border text-copy-muted'
                              )}>
                                {isApproved ? <Check className="size-2.5" /> : student.name.charAt(0)}
                              </span>
                              <span className="font-semibold">{student.name}</span>
                              <span className="text-[10px] text-copy-muted">({student.role})</span>
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
                        className="w-full h-7 rounded-lg border border-border-strong hover:bg-surface text-ink text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Approve all {pendingCount} shifts
                      </button>
                    )}
                  </div>

                  {/* Card 4: Compact Certification Ready Pill */}
                  <div className="rounded-xl border border-border bg-surface/80 dark:bg-card/80 p-2.5 shadow-xs flex items-center gap-2.5">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal-text">
                      <Award className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-heading text-xs font-bold text-ink truncate">Practicum Certification</div>
                      <div className="text-[10px] text-copy-muted truncate">Automated issuance at 300 approved hours.</div>
                    </div>
                  </div>

                </div>

                {/* Bottom Home Indicator Bar */}
                <div className="relative z-10 pb-2.5 pt-1 flex justify-center bg-surface/30">
                  <div className="h-1 w-24 rounded-full bg-border-strong" />
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
