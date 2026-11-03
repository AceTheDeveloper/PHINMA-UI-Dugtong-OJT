'use client';

import React, { useState } from 'react';

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
      '[PHASE 3: SUPERVISOR REVIEW] Notification dispatched to company supervisor.',
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
    <div className="space-y-8 font-sans">
      {/* ── KPI METRICS STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Required Hours */}
        <div className="p-5 rounded-2xl bg-white border border-[#eceef2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#596579]">
            <span>Required course hours</span>
            <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-[#0f172a] tabular-nums">
              {requiredHours.toFixed(1)}
            </span>
            <span className="text-xs text-[#596579] ml-1.5 font-medium">hrs total (BSIT)</span>
          </div>
          <div className="text-[11px] text-[#6b7686] mt-2">
            Target required for graduation certification
          </div>
        </div>

        {/* Metric 2: Accumulated Approved Hours */}
        <div className="p-5 rounded-2xl bg-white border border-[#eceef2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#596579]">
            <span>Approved accumulated</span>
            <span className="w-2 h-2 rounded-full bg-[#087a55]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#087a55] tabular-nums">
              {displayedApproved.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-[#087a55] tabular-nums">
              ({percentage}%)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-[#eceef2] h-2 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#087a55] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Remaining Hours */}
        <div className="p-5 rounded-2xl bg-white border border-[#eceef2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#596579]">
            <span>Hours remaining</span>
            <span className="w-2 h-2 rounded-full bg-[#b45309]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-[#0f172a] tabular-nums">
              {(requiredHours - displayedApproved).toFixed(1)}
            </span>
            <span className="text-xs text-[#596579] ml-1.5 font-medium">hrs to unlock</span>
          </div>
          <div className="text-[11px] text-[#6b7686] mt-2">
            Supervisor evaluation unlocks at 486.0 hrs
          </div>
        </div>

        {/* Metric 4: Active Deployment */}
        <div className="p-5 rounded-2xl bg-white border border-[#eceef2] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-[#596579]">
            <span>Active deployment</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#d9f5ea] text-[#087a55]">
              Active
            </span>
          </div>
          <div className="mt-2 text-sm font-bold text-[#0f172a] line-clamp-1">
            Western Visayas Tech Partners
          </div>
          <div className="text-[11px] text-[#596579] mt-2 flex items-center justify-between">
            <span>Supervisor: Engr. M. Ramos</span>
            <span className="text-[#2563eb] font-semibold">1 entry pending</span>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE WORKFLOW PIPELINE ARCHITECTURE ── */}
      <div className="rounded-2xl bg-white border border-[#eceef2] p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#eceef2]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563eb] tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
              <span>Deterministic-first verification architecture</span>
            </div>
            <h2 className="text-xl font-bold text-[#0f172a] mt-1">
              Automated DTR and Daily Journal Invariant Pipeline
            </h2>
            <p className="text-xs text-[#596579] mt-1 max-w-2xl leading-relaxed">
              Eliminates supervisor fatigue by running strict automated server checks before routing entries for approval.
              Errors return to the student immediately without manual triage.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={startSimulation}
              disabled={isRunning}
              className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <span>{isRunning ? 'Auditing shift...' : 'Simulate shift review'}</span>
            </button>
            <button
              onClick={resetSimulation}
              title="Reset simulation"
              className="px-3 py-2 rounded-xl border border-[#eceef2] hover:bg-[#f5f7fa] text-[#596579] text-xs font-medium transition-colors cursor-pointer"
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
                onClick={() => {
                  setActiveScenario(sc);
                  resetSimulation();
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#2563eb] bg-[#e6eefe]/50 ring-2 ring-[#2563eb]/20 shadow-xs'
                    : 'border-[#eceef2] bg-[#f8fafe] hover:border-[#d5dae2]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                  <span
                    className={
                      sc.failingPhase
                        ? 'text-[#dc2626] font-semibold'
                        : 'text-[#087a55] font-semibold'
                    }
                  >
                    {sc.failingPhase ? `Fails Phase 0${sc.failingPhase}` : 'Passes to approved'}
                  </span>
                  <span className="text-[10px] text-[#6b7686] tabular-nums">
                    {sc.hoursToAdd > 0 ? `+${sc.hoursToAdd}h` : '0h'}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#0f172a] truncate">{sc.title}</div>
                <div className="text-[11px] text-[#596579] line-clamp-2 mt-1 leading-normal">
                  {sc.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── THE 4-PHASE VISUAL WORKFLOW PIPELINE ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          {/* Phase 1: Draft Phase */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentStep >= 1
                ? 'border-[#2563eb] bg-white shadow-xs'
                : 'border-[#eceef2] bg-[#f8fafe] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#2563eb] mb-2">
              <span>Phase 01 // Draft</span>
              <span className="w-5 h-5 rounded-full bg-[#e6eefe] text-[#2563eb] flex items-center justify-center text-[10px]">
                1
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">Daily log & journal</h3>
            <p className="text-xs text-[#596579] mt-1.5 leading-relaxed">
              Student records time in, time out, and journal reflection. Status set to open/pending.
            </p>
            <div className="mt-3 pt-2.5 border-t border-[#eceef2] text-[11px] text-[#6b7686] space-y-1">
              <div>• Server clock timestamp</div>
              <div>• Lunch break duration</div>
            </div>
          </div>

          {/* Phase 2: Deterministic Pre-Flight Audit */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentStep === 2 && activeScenario.failingPhase === 2
                ? 'border-[#dc2626] bg-[#fee2e2]/30 shadow-xs'
                : currentStep >= 2
                ? 'border-[#2563eb] bg-white shadow-xs'
                : 'border-[#eceef2] bg-[#f8fafe] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#2563eb] mb-2">
              <span className={activeScenario.failingPhase === 2 && currentStep >= 2 ? 'text-[#dc2626]' : ''}>
                Phase 02 // Automated audit
              </span>
              <span className="w-5 h-5 rounded-full bg-[#e6eefe] text-[#2563eb] flex items-center justify-center text-[10px]">
                2
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">Deterministic checks</h3>
            <p className="text-xs text-[#596579] mt-1.5 leading-relaxed">
              Zero manual triage. Server validates Asia/Manila clock, deployment status, and shift collisions.
            </p>
            <div className="mt-3 pt-2.5 border-t border-[#eceef2] text-[11px] text-[#6b7686] space-y-1">
              <div>• Reject client clock drift</div>
              <div>• Word count threshold check</div>
            </div>
          </div>

          {/* Phase 3: Correction & Rejection Loop */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              activeScenario.status === 'supervisor_reopened' && currentStep >= 3
                ? 'border-[#b45309] bg-[#fef3c7]/30 shadow-xs'
                : currentStep >= 3
                ? 'border-[#2563eb] bg-white shadow-xs'
                : 'border-[#eceef2] bg-[#f8fafe] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#b45309] mb-2">
              <span>Phase 03 // Review & loop</span>
              <span className="w-5 h-5 rounded-full bg-[#fef3c7] text-[#b45309] flex items-center justify-center text-[10px]">
                3
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">Supervisor review</h3>
            <p className="text-xs text-[#596579] mt-1.5 leading-relaxed">
              Supervisor approves or rejects with required reason. Corrections return to student; audit log kept.
            </p>
            <div className="mt-3 pt-2.5 border-t border-[#eceef2] text-[11px] text-[#6b7686] space-y-1">
              <div>• Required rejection reason</div>
              <div>• Immutable revision trail</div>
            </div>
          </div>

          {/* Phase 4: Final Locked Pass */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentStep >= 4
                ? 'border-[#087a55] bg-[#d9f5ea]/20 shadow-xs'
                : 'border-[#eceef2] bg-[#f8fafe] opacity-75'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#087a55] mb-2">
              <span>Phase 04 // Accumulated</span>
              <span className="w-5 h-5 rounded-full bg-[#d9f5ea] text-[#087a55] flex items-center justify-center text-[10px]">
                4
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">Approved & locked</h3>
            <p className="text-xs text-[#596579] mt-1.5 leading-relaxed">
              Approved hours lock permanently. Accumulates to 486.0 hrs to trigger final evaluation & certificate.
            </p>
            <div className="mt-3 pt-2.5 border-t border-[#eceef2] text-[11px] text-[#6b7686] space-y-1">
              <div>• Locked against client edit</div>
              <div>• Unlocks evaluation PDF</div>
            </div>
          </div>
        </div>

        {/* ── LIVE AUDIT TELEMETRY STREAM ── */}
        {currentStep > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-[#0f172a] text-white font-mono text-xs space-y-2 border border-[#334155] overflow-x-auto shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-[#334155] text-[11px] text-[#94a3b8]">
              <span>DTR VERIFICATION ENGINE LOG // ASIA/MANILA</span>
              <span className="font-semibold text-[#38bdf8]">
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
                    className={`leading-relaxed ${
                      isFail
                        ? 'text-[#f87171] font-semibold bg-[#450a0a]/40 px-2 py-1 rounded'
                        : isPass
                        ? 'text-[#4ade80] font-semibold'
                        : isLoop
                        ? 'text-[#fbbf24] font-semibold'
                        : 'text-[#e2e8f0]'
                    }`}
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

      {/* ── MOCK DAILY DTR ENTRY DEMO CARD ── */}
      <div className="rounded-2xl bg-white border border-[#eceef2] p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#eceef2] pb-4">
          <div>
            <div className="text-xs text-[#596579] font-medium">Daily attendance journal</div>
            <h3 className="text-base font-bold text-[#0f172a] mt-0.5">
              Today&apos;s active shift log
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e6eefe] text-[#2563eb]">
            Asia/Manila: 08:00 — 17:00
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-[#f8fafe] border border-[#eceef2]">
            <div className="text-[11px] text-[#596579]">Time in (server clock)</div>
            <div className="text-lg font-bold text-[#0f172a] mt-1 tabular-nums">08:00 AM</div>
            <div className="text-[10px] text-[#087a55] mt-1 font-medium">Verified by biometrics/server</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8fafe] border border-[#eceef2]">
            <div className="text-[11px] text-[#596579]">Time out (server clock)</div>
            <div className="text-lg font-bold text-[#0f172a] mt-1 tabular-nums">05:00 PM</div>
            <div className="text-[10px] text-[#596579] mt-1 font-medium">Deducted 1.0 hr lunch break</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8fafe] border border-[#eceef2]">
            <div className="text-[11px] text-[#596579]">Net shift hours</div>
            <div className="text-lg font-bold text-[#2563eb] mt-1 tabular-nums">8.0 hrs</div>
            <div className="text-[10px] text-[#596579] mt-1 font-medium">Accumulates on approval</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#f8fafe] border border-[#eceef2] space-y-2">
          <div className="text-xs font-bold text-[#0f172a]">Daily journal entry</div>
          <p className="text-xs text-[#596579] leading-relaxed">
            &quot;Implemented the responsive student evaluation modal and standardized table row skeletons. Resolved tap target sizing on low-end mobile viewports. Documented component state changes in accordance with UX-04.&quot;
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-[#eceef2] hover:bg-[#f5f7fa] text-[#596579] text-xs font-medium cursor-pointer transition-colors"
          >
            Discard entry
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium cursor-pointer transition-colors shadow-xs"
          >
            Submit journal
          </button>
        </div>
      </div>
    </div>
  );
}

