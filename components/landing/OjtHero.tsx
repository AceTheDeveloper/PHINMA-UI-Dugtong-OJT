"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  Building2,
  RotateCw,
  LogOut,
  LogIn,
  Globe,
  Headset,
  Gift,
  RadioTower,
  Gem,
  Briefcase,
  Landmark,
  Users,
} from "lucide-react";
import { HoursChain } from "@/components/ui/hours-chain";
import { cn } from "@/lib/utils";
import { focusStyle } from "@/components/brand-link";

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // ARCHITECTURAL BENTO HERO (Fully Responsive Desktop & Mobile)
 *
 * Mobile Overhaul:
 *   - Native fluid card on mobile (hides redundant fake notch/battery/home bar)
 *   - Sleek handheld mockup preserved on desktop (lg:)
 *   - Thumb-friendly full-width touch actions
 *   - Proportional typography and tight padding on mobile screens (360px+)
 *   - Zero gradient buttons, live server clock, smooth continuous partner marquee
 * ───────────────────────────────────────────────────────────────────────────── */

const container =
  "mx-auto w-[min(100%_-_40px,1200px)] sm:w-[min(100%_-_64px,1200px)]";

export interface AccreditedPartner {
  name: string;
  category: string;
  icon?: React.ComponentType<{ className?: string }>;
  logoSrc?: string;
  darkInvert?: boolean;
  accentColor?: string;
  badgeBg?: string;
}

export const accreditedPartners: AccreditedPartner[] = [
  {
    name: "Callbox",
    category: "B2B Sales & Digital Marketing",
    logoSrc: "/partners/callbox.png",
    darkInvert: true,
    icon: Headset,
    accentColor: "text-yellow-600 dark:text-yellow-400",
    badgeBg: "bg-yellow-500/10 border-yellow-500/25",
  },
  {
    name: "F&C Jewelry",
    category: "Retail & Luxury Systems",
    logoSrc: "/partners/fc-jewelry.png",
    darkInvert: true,
    icon: Gem,
    accentColor: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/25",
  },
  {
    name: "DICT",
    category: "Gov ICT & Cybersecurity",
    logoSrc: "/partners/dict.png",
    icon: RadioTower,
    accentColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-500/10 border-blue-500/25",
  },
  {
    name: "RELX",
    category: "Analytics & Legal Tech",
    logoSrc: "/partners/relx.png",
    icon: Globe,
    accentColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/25",
  },
  {
    name: "PESO Iloilo City",
    category: "City Employment Office",
    logoSrc: "/partners/peso-iloilo-city.png",
    icon: Briefcase,
    accentColor: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-500/10 border-orange-500/25",
  },
  {
    name: "iXL",
    category: "EdTech & Learning Analytics",
    logoSrc: "/partners/ixl.png",
    icon: Sparkles,
    accentColor: "text-sky-600 dark:text-sky-400",
    badgeBg: "bg-sky-500/10 border-sky-500/25",
  },
  {
    name: "iGift",
    category: "Rewards & E-Commerce",
    logoSrc: "/partners/igift.png",
    icon: Gift,
    accentColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-500/25",
  },
  {
    name: "PESO Province of Iloilo",
    category: "Provincial Employment",
    logoSrc: "/partners/peso-province-iloilo.png",
    icon: Landmark,
    accentColor: "text-teal-600 dark:text-teal-400",
    badgeBg: "bg-teal-500/10 border-teal-500/25",
  },
  {
    name: "Inspiro",
    category: "Global CX & BPO Operations",
    logoSrc: "/partners/inspiro.png",
    icon: Users,
    accentColor: "text-rose-600 dark:text-rose-400",
    badgeBg: "bg-rose-500/10 border-rose-500/25",
  },
];

export default function OjtHero() {
  const approvedHours = 212.0;
  const requiredHours = 300.0;
  const percentage = Math.round((approvedHours / requiredHours) * 1000) / 10;

  // Real-time ticking clock for live server shift telemetry
  const [liveClock, setLiveClock] = useState("08:32:15 AM");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock(
        now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Manila",
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single stateful Toggle Switch state for Time In / Time Out
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [approvedStudents, setApprovedStudents] = useState<
    Record<string, boolean>
  >({});

  const pendingQueue = [
    { id: "ana", name: "Ana S.", hours: "8.0 h", role: "Frontend" },
    { id: "ben", name: "Ben M.", hours: "7.5 h", role: "QA Lead" },
    { id: "cara", name: "Cara D.", hours: "8.0 h", role: "Full Stack" },
  ];

  const pendingCount = pendingQueue.filter(
    (item) => !approvedStudents[item.id],
  ).length;

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
    <section className="border-b border-border bg-page-wash pt-6 sm:pt-8 pb-12 sm:pb-16">
      <div className={container}>
        {/* ── TOP SYSTEM HUD STRIP ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 sm:pb-6 border-b border-border/80 text-[11px] font-mono text-copy-muted">
          {/* <div className="flex flex-wrap items-center gap-2">
            <span className="size-2 rounded-full bg-success animate-pulse shrink-0" />
            <span className="font-bold text-ink">
              PHINMA UI CITE // PRACTICUM PORTAL
            </span>
            <span className="text-border-strong hidden sm:inline">•</span>
            <span className="text-primary font-semibold">
              ASIA/MANILA VERIFIED
            </span>
          </div> */}

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 pt-6 sm:pt-8 items-stretch">
          {/* ── LEFT / MAIN BENTO HERO PANEL (7 Cols) ── */}
          <div className="lg:col-span-7 p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-6 sm:space-y-8">
            <div className="space-y-4 sm:space-y-5">
              {/* Category Pill */}
              {/* <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 font-mono text-[11px] sm:text-xs font-semibold text-primary">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span>PRACTICUM OPERATIONS // BSIT // CITE</span>
              </div> */}

              {/* Main Headline (Responsive typography for mobile) */}
              <h1 className="font-heading text-[clamp(28px,6.8vw,56px)] font-black leading-[1.08] tracking-[-0.04em] text-ink">
                Your OJT, from application to{" "}
                <span className="text-primary italic font-serif font-normal">
                  certification.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg leading-[1.6] text-copy-muted max-w-[540px]">
                Apply to accredited partner companies, record daily shifts with
                server-side time in and time out, submit daily journals, and
                earn verified graduation credentials. Zero lost paperwork, zero
                delayed signatures.
              </p>
            </div>

            {/* CTAs & Navigation (Full-width touch targets on mobile) */}
            <div className="space-y-3.5 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Link
                  href="/dashboard"
                  className={cn(
                    "h-12 w-full sm:w-auto px-6 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer",
                    focusStyle,
                  )}
                >
                  <span>Launch Student Portal</span>
                  <ArrowRight className="size-4" />
                </Link>

                <a
                  href="#how-it-works"
                  className={cn(
                    "h-12 w-full sm:w-auto px-5 rounded-xl border border-border hover:bg-surface text-ink text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer",
                    focusStyle,
                  )}
                >
                  <span>View 6-Step Journey Map</span>
                </a>
              </div>

              {/* <div className="text-[11px] sm:text-xs text-faint">
                Accounts are managed by CITE administration • Sign-in is
                invitation-only.
              </div> */}
            </div>

            {/* Sub-Bento Info Strip (Stack on small mobile, 2-cols on sm:) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-5 border-t border-border">
              <div className="p-3.5 rounded-xl bg-surface border border-border flex items-start gap-3">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono text-copy-muted uppercase">
                    Base Location
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">
                    PHINMA University of Iloilo
                  </div>
                  <div className="text-[10px] text-copy-muted font-mono">
                    10.7202° N, 122.5621° E
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border flex items-start gap-3">
                <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono text-copy-muted uppercase">
                    Practicum Quota
                  </div>
                  <div className="text-xs font-bold text-ink mt-0.5">
                    300.0 Hours Required
                  </div>
                  <div className="text-[10px] text-primary font-mono font-semibold">
                    1 link = 30 hours
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: NATIVE MOBILE CARD (< lg) / HANDHELD PREVIEW (lg:) ── */}
          <div className="lg:col-span-5 flex justify-center items-center w-full">
            {/* On mobile: clean native container. On desktop: sleek handheld chassis. */}
            <div className="relative w-full max-w-full lg:max-w-[390px] rounded-2xl sm:rounded-3xl lg:rounded-[38px] p-0 lg:p-3.5 bg-transparent lg:bg-gradient-to-b lg:from-[#1b2b4e] lg:via-[#0e1933] lg:to-[#081020] border-0 lg:border border-border-strong/90 lg:shadow-[0_20px_50px_rgba(8,18,42,0.45),0_0_30px_rgba(34,85,242,0.18)] transition-all flex flex-col">
              {/* Screen Glass Container */}
              <div className="relative rounded-2xl sm:rounded-3xl lg:rounded-[30px] overflow-hidden border border-border/80 bg-card/95 backdrop-blur-md flex flex-col justify-between">
                {/* Mathematical Precision Dot Grid Background */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-55"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(110, 147, 255, 0.35) 1.5px, transparent 1.5px)",
                    backgroundSize: "20px 20px",
                    backgroundPosition: "10px 10px",
                  }}
                />

                {/* Top Phone Status Bar: ONLY visible on desktop mockup (hidden on real mobile phones) */}
                <div className="hidden lg:flex relative z-10 pt-2.5 pb-2 px-5 items-center justify-between border-b border-border/50 text-[10px] font-mono text-copy-muted bg-surface/50">
                  <span className="font-bold text-ink tracking-tight">
                    08:02
                  </span>

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

                {/* Mobile Top Header Chip (Shown on mobile for clean contextual heading) */}
                <div className="flex lg:hidden relative z-10 px-4 py-2.5 border-b border-border items-center justify-between text-[11px] font-mono bg-surface/40">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                    LIVE SHIFT TELEMETRY
                  </span>
                  <span className="text-copy-muted">ASIA/MANILA</span>
                </div>

                {/* Content Stack */}
                <div className="relative z-10 p-3.5 sm:p-4 space-y-3">
                  {/* Card 1: Today Shift & Live Toggle Switch */}
                  <div
                    className={cn(
                      "rounded-xl sm:rounded-2xl border p-3 sm:p-3.5 transition-all shadow-xs backdrop-blur-xs",
                      isClockedIn
                        ? "border-primary/40 bg-surface/90 shadow-[0_0_20px_rgba(34,85,242,0.08)]"
                        : "border-border bg-card/90",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold font-mono uppercase text-copy-muted">
                        Today Shift
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-all",
                          isClockedIn
                            ? "border-success-border bg-success-tint text-success-text"
                            : "border-border bg-surface text-copy-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            isClockedIn
                              ? "bg-success animate-pulse"
                              : "bg-disabled",
                          )}
                        />
                        {isClockedIn ? "Clocked in" : "Off shift"}
                      </span>
                    </div>

                    {/* Live Server Clock */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="font-mono text-2xl sm:text-3xl font-black text-ink tracking-tight tabular-nums">
                          {liveClock}
                        </div>
                        <div className="text-[10px] text-copy-muted font-mono mt-0.5">
                          {isClockedIn
                            ? "Server Time In: 08:00:00 AM"
                            : "Server Status: Standby"}
                        </div>
                      </div>
                    </div>

                    {/* Single Stateful Toggle Button (Solid, No Gradient) */}
                    <button
                      type="button"
                      onClick={handleToggleShift}
                      className={cn(
                        "mt-3 w-full h-11 rounded-xl font-bold text-xs flex items-center justify-between px-4 transition-all duration-200 cursor-pointer shadow-xs select-none relative overflow-hidden",
                        isClockedIn
                          ? "bg-error hover:bg-error-hover text-white"
                          : "bg-primary hover:bg-primary-hover text-primary-foreground",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isClockedIn ? (
                          <LogOut className="size-4 text-white" />
                        ) : (
                          <LogIn className="size-4 text-white" />
                        )}
                        <span className="font-extrabold tracking-wide uppercase">
                          {isClockedIn ? "Time Out Shift" : "Time In Shift"}
                        </span>
                      </div>

                      {/* Toggle Visual Pill Switch */}
                      <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold">
                        <span>
                          {isClockedIn ? "CLICK TO END" : "CLICK TO START"}
                        </span>
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            isClockedIn
                              ? "bg-amber-300 animate-ping"
                              : "bg-emerald-300 animate-ping",
                          )}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Card 2: Boxed Approved Hours with Looping Loading Progress */}
                  <div className="rounded-xl sm:rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-3 sm:p-3.5 shadow-xs backdrop-blur-xs relative overflow-hidden">
                    {/* Looping ambient data-sync shimmer line */}
                    <div className="animate-sync-shimmer" />

                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold font-mono uppercase text-copy-muted">
                        Approved hours
                      </span>
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
                    <div className="my-2 py-0.5">
                      <HoursChain
                        approvedHours={approvedHours}
                        requiredHours={requiredHours}
                        size="sm"
                      />
                    </div>

                    {/* Looping Progress Bar */}
                    <div className="relative h-1.5 w-full rounded-full bg-border-strong/50 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500 relative"
                        style={{ width: `${percentage}%` }}
                      >
                        <div className="absolute inset-0 bg-white/40 animate-pulse" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-copy-muted font-medium pt-1">
                      <span>Progress: {percentage}%</span>
                      <span className="text-primary font-bold">
                        88 hours to go
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Supervisor Review Quick Queue */}
                  <div className="rounded-xl sm:rounded-2xl border border-border bg-surface/90 dark:bg-card/90 p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold font-mono uppercase text-copy-muted">
                        Supervisor Review
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          pendingCount > 0
                            ? "border-warning-border bg-warning-tint text-warning-text"
                            : "border-success-border bg-success-tint text-success-text",
                        )}
                      >
                        {pendingCount > 0
                          ? `${pendingCount} pending`
                          : "All signed"}
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
                              "flex items-center justify-between p-1.5 px-2.5 rounded-xl border text-[11px] transition-all cursor-pointer",
                              isApproved
                                ? "bg-success-tint/40 border-success-border/60 text-success-text"
                                : "bg-card dark:bg-surface/60 border-border text-ink hover:border-primary/50",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                                  isApproved
                                    ? "bg-success text-white"
                                    : "bg-surface border border-border text-copy-muted",
                                )}
                              >
                                {isApproved ? (
                                  <Check className="size-2.5" />
                                ) : (
                                  student.name.charAt(0)
                                )}
                              </span>
                              <span className="font-semibold">
                                {student.name}
                              </span>
                              <span className="text-[10px] text-copy-muted">
                                ({student.role})
                              </span>
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
                        className="w-full h-8 rounded-lg border border-border-strong hover:bg-surface text-ink text-[10px] font-bold transition-colors cursor-pointer"
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
                      <div className="font-heading text-xs font-bold text-ink truncate">
                        Practicum Certification
                      </div>
                      <div className="text-[10px] text-copy-muted truncate">
                        Automated issuance at 300 approved hours.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Home Indicator Bar: Desktop ONLY */}
                <div className="hidden lg:flex relative z-10 pb-2.5 pt-1 justify-center bg-surface/30">
                  <div className="h-1 w-24 rounded-full bg-border-strong" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTINUOUS PARTNER MARQUEE TICKER (Free-Floating Stream, Zero Boxes/Cards) ── */}
        {/* <div className="mt-8 sm:mt-12 pt-6 border-t border-border flex flex-col md:flex-row md:items-center gap-3 sm:gap-6 text-xs font-mono text-copy-muted overflow-hidden">
          <div className="shrink-0 font-bold uppercase text-ink flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <span className="tracking-wide">Accredited Partners:</span>
          </div>

          <div 
            className="relative flex-1 overflow-hidden py-1"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
            }}
          >
            <div className="animate-marquee whitespace-nowrap flex items-center gap-6 sm:gap-8 select-none">
              {accreditedPartners.map((partner, i) => {
                const IconComponent = partner.icon;
                return (
                  <div
                    key={`p1-${i}`}
                    className="inline-flex items-center gap-2.5 py-1 group cursor-default transition-all duration-150 opacity-80 hover:opacity-100"
                  >
                    {partner.logoSrc ? (
                      <img
                        src={partner.logoSrc}
                        alt={`${partner.name} logo`}
                        className={cn(
                          "h-6 sm:h-7 w-auto max-w-[120px] object-contain shrink-0 filter contrast-105 group-hover:scale-105 transition-transform",
                          partner.darkInvert && "dark:brightness-0 dark:invert"
                        )}
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex items-center justify-center shrink-0 text-primary">
                        {IconComponent && <IconComponent className="size-4" />}
                      </span>
                    )}
                    <span className="font-heading text-xs sm:text-sm font-bold text-ink group-hover:text-primary transition-colors whitespace-nowrap">
                      {partner.name}
                    </span>
                    <span className="text-[10px] font-mono text-copy-muted hidden md:inline whitespace-nowrap">
                      ({partner.category})
                    </span>
                    <span className="text-border-strong select-none text-xs ml-3 sm:ml-4">•</span>
                  </div>
                );
              })}

              {accreditedPartners.map((partner, i) => {
                const IconComponent = partner.icon;
                return (
                  <div
                    key={`p2-${i}`}
                    className="inline-flex items-center gap-2.5 py-1 group cursor-default transition-all duration-150 opacity-80 hover:opacity-100"
                  >
                    {partner.logoSrc ? (
                      <img
                        src={partner.logoSrc}
                        alt={`${partner.name} logo`}
                        className={cn(
                          "h-6 sm:h-7 w-auto max-w-[120px] object-contain shrink-0 filter contrast-105 group-hover:scale-105 transition-transform",
                          partner.darkInvert && "dark:brightness-0 dark:invert"
                        )}
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex items-center justify-center shrink-0 text-primary">
                        {IconComponent && <IconComponent className="size-4" />}
                      </span>
                    )}
                    <span className="font-heading text-xs sm:text-sm font-bold text-ink group-hover:text-primary transition-colors whitespace-nowrap">
                      {partner.name}
                    </span>
                    <span className="text-[10px] font-mono text-copy-muted hidden md:inline whitespace-nowrap">
                      ({partner.category})
                    </span>
                    <span className="text-border-strong select-none text-xs ml-3 sm:ml-4">•</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div> */}
      </div>
    </section>
  );
}
