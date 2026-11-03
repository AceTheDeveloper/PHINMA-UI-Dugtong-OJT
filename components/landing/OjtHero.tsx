'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Building2, MapPin, CheckCircle2, Shield, Sparkles, ExternalLink } from 'lucide-react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // ARCHITECTURAL BENTO HERO
 *
 * Synthesized from Neil's Portfolio Hero (Image 3):
 *   - Top Status HUD Pill (System online, Asia/Manila server authoritative)
 *   - Bento Sectioning (Main Editorial Statement + Live Interactive Telemetry Card)
 *   - Location Base Card (PHINMA University of Iloilo coordinates)
 *   - Continuous Partner Marquee Ticker Strip
 * ──────────────────────────────────────────────────────────────────────────── */

const container = 'mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]';

export default function OjtHero() {
  const approvedHours = 212.0;
  const requiredHours = 486.0;
  const percentage = Math.round((approvedHours / requiredHours) * 1000) / 10;

  return (
    <section className="border-b border-border bg-page-wash pt-8 pb-16">
      <div className={container}>
        {/* ── TOP SYSTEM HUD STRIP (Matching Portfolio Image 3) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-border/80 text-[11px] font-mono text-copy-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            <span className="font-bold text-ink">PHINMA UI CITE // PRACTICUM PORTAL</span>
            <span>•</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-8">
          {/* ── LEFT / MAIN BENTO HERO PANEL (7 Cols) ── */}
          <div className="lg:col-span-7 p-8 sm:p-10 rounded-3xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 font-mono text-xs font-semibold text-primary">
                <Sparkles className="size-3 text-primary" />
                <span>PRACTICUM OPERATIONS // BSIT // CITE</span>
              </div>

              {/* Main Headline (Editorial Polish) */}
              <h1 className="font-heading text-[clamp(36px,4.5vw,58px)] font-black leading-[1.05] tracking-[-0.04em] text-ink">
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
                  <div className="text-xs font-bold text-ink mt-0.5">486.0 Hours Required</div>
                  <div className="text-[10px] text-primary font-mono font-semibold">1 link = 40 hours</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT BENTO PANEL (5 Cols: Live Interactive Telemetry Card) ── */}
          <div className="lg:col-span-5 p-8 rounded-3xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-6">
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-bold font-mono uppercase text-ink">
                    Live Shift Telemetry
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-success-tint text-success-text">
                  Clocked in
                </span>
              </div>

              {/* Time & Shift Hero */}
              <div className="my-6">
                <div className="text-[11px] font-mono text-copy-muted uppercase">
                  Asia/Manila Server Clock
                </div>
                <div className="text-4xl font-black text-ink mt-1 tabular-nums">
                  08:32:15 AM
                </div>
                <div className="text-xs font-semibold text-primary mt-1 flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  <span>Western Visayas Tech Partners Inc.</span>
                </div>
              </div>

              {/* Signature Hours Chain Visualizer */}
              <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-copy-muted">Approved Hours</span>
                  <span className="font-bold text-ink tabular-nums">
                    {approvedHours.toFixed(1)} / {requiredHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="py-1">
                  <HoursChain approvedHours={approvedHours} requiredHours={requiredHours} size="md" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-copy-muted pt-1">
                  <span>Progress: {percentage}%</span>
                  <span className="text-primary font-bold">274.0 hrs remaining</span>
                </div>
              </div>
            </div>

            {/* Quick Shift Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="text-[10px] font-mono text-copy-muted uppercase">Today&apos;s Time in</div>
                <div className="text-sm font-bold text-ink mt-0.5 tabular-nums">08:00 AM</div>
                <div className="text-[10px] text-success mt-0.5 font-medium">On-time entry</div>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="text-[10px] font-mono text-copy-muted uppercase">Pending Queue</div>
                <div className="text-sm font-bold text-warning-text mt-0.5 tabular-nums">3 entries</div>
                <div className="text-[10px] text-copy-muted mt-0.5">Same-day signoff</div>
              </div>
            </div>

            {/* Direct Link to Portal */}
            <Link
              href="/dashboard"
              className="w-full py-3 rounded-xl border border-border hover:bg-surface text-center text-xs font-bold text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View Full Student Dashboard</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* ── CONTINUOUS PARTNER MARQUEE TICKER (Matching Portfolio Image 3) ── */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono text-copy-muted overflow-hidden">
          <div className="shrink-0 font-bold uppercase text-ink flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Accredited Industry Partners:</span>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap text-[11px] py-1">
            <span className="hover:text-primary transition-colors">Western Visayas Tech Partners Inc.</span>
            <span>•</span>
            <span className="hover:text-primary transition-colors">Iloilo Digital Innovations Hub</span>
            <span>•</span>
            <span className="hover:text-primary transition-colors">Panay Cloud Solutions Corp.</span>
            <span>•</span>
            <span className="hover:text-primary transition-colors">Metro Iloilo Dev Labs</span>
            <span>•</span>
            <span className="hover:text-primary transition-colors">CITE Software Engineering Cell</span>
            <span>•</span>
            <span className="hover:text-primary transition-colors">Panay Telecom Networks</span>
          </div>
        </div>
      </div>
    </section>
  );
}
