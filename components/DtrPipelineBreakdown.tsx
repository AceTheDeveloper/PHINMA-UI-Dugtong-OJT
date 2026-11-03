'use client';

import React, { useState } from 'react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT — DETERMINISTIC-FIRST VERIFICATION PIPELINE
 *
 * Replaces expensive manual triage with automated server-side invariants:
 *   Phase 1: Student Time In/Out & Daily Journal Draft
 *   Phase 2: Deterministic Invariant Audit (Automated server clock & schema checks)
 *   Phase 3: The "Fail" Branch (Supervisor Rejection / Student Correction Loop)
 *   Phase 4: The "Pass" Branch (Locked Approved Hours & Final Certification)
 * ──────────────────────────────────────────────────────────────────────────── */

interface Scenario {
  id: string;
  title: string;
  description: string;
  failingPhase: 2 | 3 | null;
  status: 'approved' | 'rejected_clock' | 'rejected_journal' | 'supervisor_reopened';
  logs: string[];
  hoursToAdd: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'clean-shift',
    title: 'Standard 8-hour shift + journal',
    description: 'Student completed 08:00 to 17:00 shift with 1-hour break and structured journal reflection.',
    failingPhase: null,
    status: 'approved',
    hoursToAdd: 8.0,
    logs: [
      '[PHASE 1: DRAFT] Time in (08:00) & time out (17:00) recorded with server timestamp.',
      '[PHASE 1: DRAFT] Daily journal attached (142 words, technical summary).',
      '[PHASE 2: DETERMINISTIC AUDIT] Server clock check: Asia/Manila server time confirmed (no client clock drift).',
      '[PHASE 2: DETERMINISTIC AUDIT] Active deployment confirmed: 1 active placement at Western Visayas Tech Partners.',
      '[PHASE 2: DETERMINISTIC AUDIT] Break duration deducted: 1.0 hr lunch break subtracted (net: 8.0 hrs).',
      '[PHASE 2: DETERMINISTIC AUDIT] No shift collision: Zero overlap with prior approved records.',
      '[PHASE 3: SUPERVISOR REVIEW] Notification dispatched to company supervisor queue.',
      '[PHASE 4: APPROVED & ACCUMULATED] Supervisor approved shift. +8.0 hrs added to student ledger. Entry locked.',
    ],
  },
  {
    id: 'clock-spoof',
    title: 'Client device clock manipulation',
    description: 'Device timestamp attempted to claim 10 hours by altering local mobile phone time.',
    failingPhase: 2,
    status: 'rejected_clock',
    hoursToAdd: 0,
    logs: [
      '[PHASE 1: DRAFT] Submission received from student mobile client.',
      '🚨 [PHASE 2: DETERMINISTIC AUDIT] SERVER CLOCK INVARIANT TRIGGERED!',
      '🛑 Client device clock claims 19:30, but authoritative Asia/Manila server clock is 16:15.',
      '🛑 Hard invariant failure: Client-provided timestamps are strictly rejected.',
      '🛑 Entry flagged in audit log. Log reset to official server timestamp. Zero supervisor time wasted.',
    ],
  },
  {
    id: 'missing-journal',
    title: 'Missing daily journal reflection',
    description: 'Student clocked out but left the mandatory daily journal submission blank.',
    failingPhase: 2,
    status: 'rejected_journal',
    hoursToAdd: 0,
    logs: [
      '[PHASE 1: DRAFT] Student timed in and timed out successfully.',
      '🚨 [PHASE 2: DETERMINISTIC AUDIT] JOURNAL COMPLETENESS CHECK FAILED!',
      '🛑 Daily journal contains 0 words. Minimum requirement is 30 words describing tasks performed.',
      '🛑 System blocked status change to pending. Entry returned to student with prompt: "Add your journal before submitting."',
      '🛑 Supervisor queue remains clean. Zero manual triage required.',
    ],
  },
  {
    id: 'supervisor-revision',
    title: 'Supervisor requested time correction',
    description: 'Supervisor notes early departure for company training and requests a 1-hour revision.',
    failingPhase: 3,
    status: 'supervisor_reopened',
    hoursToAdd: 7.0,
    logs: [
      '[PHASE 1: DRAFT] Student submitted 8-hour shift entry.',
      '[PHASE 2: DETERMINISTIC AUDIT] Automated format and collision checks passed.',
      '[PHASE 3: SUPERVISOR REVIEW] Supervisor reviewed: "Left at 16:00 for offsite training. Please adjust to 7 hours."',
      '🔄 [CORRECTION LOOP TRIGGERED] Status set to rejected with required supervisor reason.',
      '[STUDENT CORRECTION] Student updated time out to 16:00 and resubmitted with explanation.',
      '[PHASE 2: DETERMINISTIC RE-CHECK] Re-validated format and recalculated 7.0 net hours.',
      '[PHASE 4: APPROVED & ACCUMULATED] Supervisor approved revised entry. +7.0 hrs added to course ledger. Full audit trail preserved.',
    ],
  },
];

const container = 'mx-auto w-[min(100%_-_64px,1200px)] max-md:w-[calc(100%_-_48px)]';

export default function DtrPipelineBreakdown() {
  const [activeScenario, setActiveScenario] = useState<Scenario>(SCENARIOS[0]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Student cumulative progress demo state
  const requiredHours = 486.0;
  const initialApproved = 342.5;
  const [displayedApproved, setDisplayedApproved] = useState<number>(initialApproved);

  const startSimulation = () => {
    setIsRunning(true);
    setIsCompleted(false);
    setCurrentStep(1);
    setDisplayedApproved(initialApproved);

    const step1 = setTimeout(() => {
      setCurrentStep(2);

      const step2 = setTimeout(() => {
        if (activeScenario.failingPhase === 2) {
          setIsRunning(false);
          setIsCompleted(true);
          return;
        }

        setCurrentStep(3);

        const step3 = setTimeout(() => {
          if (activeScenario.failingPhase === 3 && activeScenario.hoursToAdd === 0) {
            setIsRunning(false);
            setIsCompleted(true);
            return;
          }

          setCurrentStep(4);
          setDisplayedApproved(initialApproved + activeScenario.hoursToAdd);
          setIsRunning(false);
          setIsCompleted(true);
        }, 900);

        return () => clearTimeout(step3);
      }, 900);

      return () => clearTimeout(step2);
    }, 800);

    return () => clearTimeout(step1);
  };

  const resetSimulation = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setCurrentStep(0);
    setDisplayedApproved(initialApproved);
  };

  const percentage = Math.min(100, Math.round((displayedApproved / requiredHours) * 1000) / 10);

  return (
    <section id="verification-pipeline" className="border-b border-border bg-surface py-20 max-sm:py-14" data-reveal>
      <div className={container}>
        {/* Section Header */}
        <div className="space-y-3 max-w-[720px] mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 font-mono text-xs font-semibold text-primary">
            <span className="size-2 rounded-full bg-primary" />
            <span>Deterministic verification pipeline</span>
          </span>
          <h2 className="font-heading text-[clamp(28px,3.2vw,40px)] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
            How Dugtong verifies every shift before supervisor review.
          </h2>
          <p className="text-base leading-[1.65] text-copy-muted">
            Rather than relying on manual supervisor triage, the server runs strict automated invariant checks. 
            Anomalies and missing fields return to the student immediately, saving supervisor time for what matters.
          </p>
        </div>

        {/* ── KPI METRICS STRIP WITH SIGNATURE HOURS CHAIN ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Card 1: Hours Chain Progress */}
          <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-copy-muted mb-2">
                <span>The hours chain</span>
                <span className="font-mono text-[11px] font-semibold text-primary">
                  1 link = 40 hours
                </span>
              </div>
              <div className="my-2 py-1">
                <HoursChain approvedHours={displayedApproved} requiredHours={requiredHours} size="md" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-baseline justify-between text-xs font-medium">
              <span className="text-copy-muted">Progress toward 486.0 hrs</span>
              <span className="font-bold text-ink tabular-nums">
                {displayedApproved.toFixed(1)} / {requiredHours.toFixed(1)} hrs ({percentage}%)
              </span>
            </div>
          </div>

          {/* Card 2: Hours Remaining */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-copy-muted">
              <span>Hours remaining</span>
              <span className="size-2 rounded-full bg-warning" />
            </div>
            <div className="my-3">
              <span className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                {(requiredHours - displayedApproved).toFixed(1)}
              </span>
              <span className="text-xs text-copy-muted ml-1.5 font-medium">hrs left</span>
            </div>
            <div className="text-xs text-copy-muted">
              Supervisor evaluation unlocks at 486.0 hrs
            </div>
          </div>

          {/* Card 3: Active Placement */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-copy-muted">
              <span>Active deployment</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-tint text-success-text">
                Active
              </span>
            </div>
            <div className="my-2 text-sm font-bold text-ink line-clamp-1">
              Western Visayas Tech Partners
            </div>
            <div className="text-xs text-copy-muted flex items-center justify-between pt-1">
              <span>Supervisor: Engr. M. Ramos</span>
              <span className="text-primary font-semibold">1 pending</span>
            </div>
          </div>
        </div>

        {/* ── THE INTERACTIVE VERIFICATION SIMULATOR ── */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
            <div>
              <h3 className="font-heading text-lg font-bold text-ink">
                Interactive DTR verification simulator
              </h3>
              <p className="text-xs text-copy-muted mt-0.5">
                Select a shift scenario to watch how deterministic rules protect supervisor queues from manual errors.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={startSimulation}
                disabled={isRunning}
                className={cn(
                  "h-10 px-4 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer",
                  focusStyle
                )}
              >
                <span>{isRunning ? 'Auditing shift...' : 'Simulate shift review'}</span>
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className={cn(
                  "h-10 px-3 rounded-lg border border-border-strong hover:bg-surface text-copy-muted text-xs font-medium transition-colors cursor-pointer",
                  focusStyle
                )}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Scenario Selection Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCENARIOS.map((sc) => {
              const isSelected = activeScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setActiveScenario(sc);
                    resetSimulation();
                  }}
                  className={cn(
                    "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary-tint/60 ring-2 ring-primary/20"
                      : "border-border bg-surface hover:border-border-strong"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                    <span
                      className={
                        sc.failingPhase
                          ? "text-error font-semibold"
                          : "text-success font-semibold"
                      }
                    >
                      {sc.failingPhase ? `Fails Phase 0${sc.failingPhase}` : 'Passes to approved'}
                    </span>
                    <span className="text-[10px] text-copy-muted tabular-nums">
                      {sc.hoursToAdd > 0 ? `+${sc.hoursToAdd}h` : '0h'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink truncate">{sc.title}</div>
                  <div className="text-[11px] text-copy-muted line-clamp-2 mt-1 leading-normal">
                    {sc.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 4-PHASE VISUAL WORKFLOW ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            {/* Phase 1: Draft */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all",
                currentStep >= 1 ? "border-primary bg-card" : "border-border bg-surface opacity-70"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-primary mb-2">
                <span>Phase 01 // Draft</span>
                <span className="size-5 rounded-full bg-primary-tint text-primary flex items-center justify-center text-[10px]">
                  1
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink">Daily log & journal</h4>
              <p className="text-xs text-copy-muted mt-1 leading-relaxed">
                Student records time in, time out, and journal reflection.
              </p>
              <div className="mt-3 pt-2 border-t border-border text-[11px] text-copy-muted space-y-0.5">
                <div>• Server clock timestamp</div>
                <div>• Lunch break duration</div>
              </div>
            </div>

            {/* Phase 2: Deterministic Pre-Flight Audit */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all",
                currentStep === 2 && activeScenario.failingPhase === 2
                  ? "border-error bg-error-tint/40"
                  : currentStep >= 2
                  ? "border-primary bg-card"
                  : "border-border bg-surface opacity-70"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-primary mb-2">
                <span className={activeScenario.failingPhase === 2 && currentStep >= 2 ? "text-error" : ""}>
                  Phase 02 // Automated audit
                </span>
                <span className="size-5 rounded-full bg-primary-tint text-primary flex items-center justify-center text-[10px]">
                  2
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink">Deterministic checks</h4>
              <p className="text-xs text-copy-muted mt-1 leading-relaxed">
                Automated checks: Asia/Manila clock, single deployment, collision.
              </p>
              <div className="mt-3 pt-2 border-t border-border text-[11px] text-copy-muted space-y-0.5">
                <div>• Reject device clock drift</div>
                <div>• Reflection word-count check</div>
              </div>
            </div>

            {/* Phase 3: Review & Correction Loop */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all",
                activeScenario.status === 'supervisor_reopened' && currentStep >= 3
                  ? "border-warning bg-warning-tint/40"
                  : currentStep >= 3
                  ? "border-primary bg-card"
                  : "border-border bg-surface opacity-70"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-warning mb-2">
                <span>Phase 03 // Review & loop</span>
                <span className="size-5 rounded-full bg-warning-tint text-warning flex items-center justify-center text-[10px]">
                  3
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink">Supervisor review</h4>
              <p className="text-xs text-copy-muted mt-1 leading-relaxed">
                Approve or reject with reason. Corrections return to student.
              </p>
              <div className="mt-3 pt-2 border-t border-border text-[11px] text-copy-muted space-y-0.5">
                <div>• Required rejection reason</div>
                <div>• Immutable revision trail</div>
              </div>
            </div>

            {/* Phase 4: Approved & Locked Accumulation */}
            <div
              className={cn(
                "p-4 rounded-xl border transition-all",
                currentStep >= 4 ? "border-success bg-success-tint/30" : "border-border bg-surface opacity-70"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-success mb-2">
                <span>Phase 04 // Accumulated</span>
                <span className="size-5 rounded-full bg-success-tint text-success flex items-center justify-center text-[10px]">
                  4
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink">Approved & locked</h4>
              <p className="text-xs text-copy-muted mt-1 leading-relaxed">
                Hours lock permanently and add to the 486.0 hrs requirement.
              </p>
              <div className="mt-3 pt-2 border-t border-border text-[11px] text-copy-muted space-y-0.5">
                <div>• Locked against client edits</div>
                <div>• Unlocks final certificate</div>
              </div>
            </div>
          </div>

          {/* ── LIVE AUDIT TELEMETRY STREAM ── */}
          {currentStep > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-ink text-surface font-mono text-xs space-y-2 border border-border-strong overflow-x-auto shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-border-strong text-[11px] text-muted">
                <span>DTR INVARIANT ENGINE LOG // ASIA/MANILA</span>
                <span className="font-semibold text-primary">
                  {isRunning ? 'PROCESSING SHIFT...' : isCompleted ? (activeScenario.failingPhase ? 'FLAGGED / REJECTED' : 'HOURS COMMITTED') : 'READY'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {activeScenario.logs.slice(0, currentStep * 2).map((line, idx) => {
                  const isFail = line.includes('🚨') || line.includes('🛑');
                  const isPass = line.includes('APPROVED');
                  const isLoop = line.includes('CORRECTION LOOP');

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "leading-relaxed",
                        isFail
                          ? "text-[#f87171] font-semibold bg-[#450a0a]/50 px-2 py-1 rounded"
                          : isPass
                          ? "text-[#4ade80] font-semibold"
                          : isLoop
                          ? "text-[#fbbf24] font-semibold"
                          : "text-slate-200"
                      )}
                    >
                      <span>{'> '}</span>
                      <span>{line}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
