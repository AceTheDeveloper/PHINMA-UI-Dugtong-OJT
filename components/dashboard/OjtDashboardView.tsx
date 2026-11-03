'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  ArrowRight,
  Send,
  Check,
  X,
  Coffee,
  GraduationCap,
  Briefcase,
  RotateCw,
  LogOut,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ─────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT // PROFESSIONAL ACADEMIC & PRACTICUM DASHBOARD
 *
 * Implements Neil's Portfolio & Cortex Design Rules:
 *   - Single prominent stateful Time In / Time Out toggle switch button
 *     (Transitions smoothly between Green/Blue and Red/Orange with glow shifts)
 *   - Live real-time Asia/Manila server clock ticking every second
 *   - Looping loading sequence across the Approved Hours Chain & progress bar
 *   - Clean, non-distracting role selector (Student Portal vs. Supervisor Deck)
 *   - Daily journal with minimum word verification
 *   - Supervisor bulk approvals & revision modal
 * ───────────────────────────────────────────────────────────────────────────── */

interface LogEntry {
  id: string;
  date: string;
  timeIn: string;
  timeOut: string;
  breakDuration: string;
  netHours: number;
  status: 'approved' | 'pending' | 'rejected';
  journal: string;
  supervisorNote?: string;
}

interface PendingApproval {
  id: string;
  studentName: string;
  studentId: string;
  section: string;
  company: string;
  date: string;
  timeIn: string;
  timeOut: string;
  netHours: number;
  journal: string;
}

export default function OjtDashboardView() {
  const [activeRole, setActiveRole] = useState<'student' | 'coordinator'>('student');

  // ── LIVE CLOCK STATE (Ticks every second) ──
  const [currentClock, setCurrentClock] = useState('08:32:15 AM');
  const [currentDateFormatted, setCurrentDateFormatted] = useState('Tuesday, November 3, 2026');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentClock(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDateFormatted(
        now.toLocaleDateString('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── STUDENT STATE ──
  const [isClockedIn, setIsClockedIn] = useState<boolean>(true);
  const [clockInTime, setClockInTime] = useState<string>('08:00 AM');
  const [journalInput, setJournalInput] = useState<string>(
    'Implemented responsive modal dialogs and fixed mobile tap target constraints for student applications. Verified contrast compliance under dark mode.'
  );
  const [journalSubmitted, setJournalSubmitted] = useState<boolean>(false);

  // Student progress numbers
  const requiredHours = 300.0;
  const approvedHours = 212.0;
  const remainingHours = requiredHours - approvedHours;
  const percentage = Math.round((approvedHours / requiredHours) * 1000) / 10;

  // Student timesheet records
  const [studentLogs, setStudentLogs] = useState<LogEntry[]>([
    {
      id: 'log-01',
      date: 'Today, Nov 3',
      timeIn: '08:00 AM',
      timeOut: '--:--',
      breakDuration: '1.0 hr',
      netHours: 8.0,
      status: 'pending',
      journal: 'Active shift in progress at RELX (Reed Elsevier).',
    },
    {
      id: 'log-02',
      date: 'Mon, Nov 2',
      timeIn: '08:00 AM',
      timeOut: '05:00 PM',
      breakDuration: '1.0 hr',
      netHours: 8.0,
      status: 'approved',
      journal: 'Assisted senior QA with end-to-end regression testing on student deployment forms.',
    },
    {
      id: 'log-03',
      date: 'Fri, Oct 30',
      timeIn: '08:30 AM',
      timeOut: '04:30 PM',
      breakDuration: '1.0 hr',
      netHours: 7.0,
      status: 'approved',
      journal: 'Setup development container environment and configured local Supabase authentication.',
    },
    {
      id: 'log-04',
      date: 'Thu, Oct 29',
      timeIn: '08:00 AM',
      timeOut: '05:00 PM',
      breakDuration: '1.0 hr',
      netHours: 8.0,
      status: 'approved',
      journal: 'Attended sprint planning with the product team and drafted initial component specs.',
    },
  ]);

  // ── COORDINATOR / SUPERVISOR STATE ──
  const [pendingList, setPendingList] = useState<PendingApproval[]>([
    {
      id: 'p-1',
      studentName: 'Neil Alisasis',
      studentId: '04-2223-0192',
      section: 'BSIT 4-A',
      company: 'RELX',
      date: 'Nov 2, 2026',
      timeIn: '08:00 AM',
      timeOut: '05:00 PM',
      netHours: 8.0,
      journal:
        'Implemented responsive modal dialogs and fixed mobile tap target constraints for student applications. Verified contrast compliance under dark mode.',
    },
    {
      id: 'p-2',
      studentName: 'Maria Sophia Santos',
      studentId: '04-2223-0841',
      section: 'BSIT 4-B',
      company: 'Callbox',
      date: 'Nov 2, 2026',
      timeIn: '08:30 AM',
      timeOut: '05:30 PM',
      netHours: 8.0,
      journal:
        'Audited relational database queries and indexed foreign key references for student deployment tables.',
    },
    {
      id: 'p-3',
      studentName: 'Joshua De la Cruz',
      studentId: '04-2223-0415',
      section: 'BSIT 4-A',
      company: 'Inspiro',
      date: 'Nov 1, 2026',
      timeIn: '08:00 AM',
      timeOut: '04:00 PM',
      netHours: 7.0,
      journal:
        'Configured staging deployment workflows and automated daily backup verification routines.',
    },
  ]);

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Single Stateful Toggle Switch Handler (Requirement 1)
  const handleToggleClock = () => {
    if (isClockedIn) {
      setIsClockedIn(false);
      showToast('Shift Ended (Time Out: 05:00 PM). Please finalize your daily journal.');
    } else {
      setIsClockedIn(true);
      setClockInTime('08:00 AM');
      showToast('Shift Started (Time In: 08:00 AM Asia/Manila authoritative server stamp).');
    }
  };

  const handleApprove = (id: string, name: string) => {
    setPendingList((prev) => prev.filter((item) => item.id !== id));
    showToast(`Approved 8.0 hours for ${name}`);
  };

  const handleConfirmReject = () => {
    if (!rejectingItem || !rejectionReason.trim()) return;
    setPendingList((prev) => prev.filter((item) => item.id !== rejectingItem.id));
    showToast(`Returned shift to ${rejectingItem.studentName} for revision`);
    setRejectingItem(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-8 font-sans">
      {/* ── ROLE SWITCHER (Sleek Segmented Pill, No Long Awkward Tabs) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-2xl bg-surface/90 border border-border backdrop-blur-sm">
        <div className="flex items-center gap-2 px-1">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-copy-muted">
            Interactive OJT Experience
          </span>
          <span className="text-xs text-border-strong">•</span>
          <span className="text-xs font-semibold text-primary">
            {activeRole === 'student' ? 'Student Portal' : 'Supervisor & Coordinator Deck'}
          </span>
        </div>

        {/* Clean Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border">
          <button
            type="button"
            onClick={() => setActiveRole('student')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none',
              activeRole === 'student'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-copy-muted hover:text-ink'
            )}
          >
            <GraduationCap className="size-3.5" />
            <span>Student Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRole('coordinator')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none',
              activeRole === 'coordinator'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-copy-muted hover:text-ink'
            )}
          >
            <Briefcase className="size-3.5" />
            <span>Supervisor Deck</span>
            {pendingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning text-warning-text font-bold">
                {pendingList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TOAST NOTIFICATION (Top-right, never obscuring actions or table) ── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl bg-card dark:bg-[#101b33] text-ink border border-border dark:border-slate-700 shadow-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="size-4 text-success shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          SCREEN A: THE STUDENT DASHBOARD
          ────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'student' && (
        <div className="space-y-6">
          {/* Header & Hours Chain Progress Card */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-6 relative overflow-hidden">
            {/* Ambient Data-Sync Scan Line */}
            <div className="animate-sync-shimmer" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-primary uppercase tracking-wide">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>PHINMA UI // College of Information Technology Education</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mt-1">
                  Hello, Neil Alisasis.
                </h2>
                <p className="text-xs text-copy-muted mt-0.5">
                  BSIT Practicum • RELX (Supervisor: Cybele Custodio)
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-success-tint text-success-text border border-success-border">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  <span>Deployment active</span>
                </span>
              </div>
            </div>

            {/* Signature Hours Chain Visualizer with Looping Loading Animation (Requirement 2) */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs font-medium mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-copy-muted font-bold font-mono uppercase">OJT Hours Accumulation</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                    <RotateCw className="size-2.5 animate-spin" />
                    <span>Live Syncing</span>
                  </span>
                </div>
                <span className="font-bold text-ink tabular-nums text-sm">
                  {approvedHours.toFixed(1)} / {requiredHours.toFixed(1)} hrs ({percentage}%)
                </span>
              </div>

              {/* Dugtong Hours Chain: One link per 30 hours */}
              <div className="py-2 overflow-x-auto relative">
                <HoursChain approvedHours={approvedHours} requiredHours={requiredHours} size="md" />
              </div>

              {/* Looping Loading Progress Bar */}
              <div className="relative h-2 w-full rounded-full bg-border-strong/40 overflow-hidden mt-3">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-primary via-teal-bright to-primary transition-all duration-500 relative"
                  style={{ width: `${percentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/40 animate-pulse" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-copy-muted">
                <span>1 link = 30 approved hours</span>
                <span className="tabular-nums font-semibold text-primary">
                  {remainingHours.toFixed(1)} hrs remaining for graduation clearance
                </span>
              </div>
            </div>
          </div>

          {/* Action Center (Hero Card: Single Stateful Time In / Time Out Toggle Button) */}
          <div className={cn(
            'p-7 rounded-2xl border transition-all duration-300 shadow-sm relative overflow-hidden',
            isClockedIn 
              ? 'bg-card border-primary/50 shadow-[0_0_30px_rgba(34,85,242,0.08)]' 
              : 'bg-card border-border'
          )}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Real-Time Server Clock & Shift Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-copy-muted font-medium">
                  <Calendar className="size-3.5 text-primary" />
                  <span>{currentDateFormatted} • Asia/Manila Server Clock</span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-ink tabular-nums tracking-tight">
                    {currentClock}
                  </span>
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                      isClockedIn
                        ? 'border-success-border bg-success-tint text-success-text'
                        : 'border-border bg-surface text-copy-muted'
                    )}
                  >
                    <span className={cn(
                      'size-1.5 rounded-full inline-block mr-1.5',
                      isClockedIn ? 'bg-success animate-pulse' : 'bg-disabled'
                    )} />
                    {isClockedIn ? 'Currently clocked in' : 'Off shift (Standby)'}
                  </span>
                </div>

                <p className="text-xs text-copy-muted leading-relaxed max-w-md">
                  {isClockedIn
                    ? `Timed in at ${clockInTime}. Net shift duration: 3h 12m (lunch break deducted automatically).`
                    : 'Ready to start your shift. Click the button to clock in.'}
                </p>
              </div>

              {/* Right: SINGLE PROMINENT STATEFUL TOGGLE BUTTON (Requirement 1) */}
              <div className="flex flex-col items-start lg:items-end gap-2">
                <button
                  type="button"
                  onClick={handleToggleClock}
                  className={cn(
                    'h-14 min-w-[240px] px-6 rounded-2xl font-black text-sm flex items-center justify-between gap-4 transition-all duration-200 cursor-pointer shadow-xs select-none relative overflow-hidden group',
                    isClockedIn
                      ? 'bg-error hover:bg-[#b91c1c] text-white'
                      : 'bg-primary hover:bg-primary-hover text-primary-foreground',
                    focusStyle
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {isClockedIn ? (
                      <LogOut className="size-5 transition-transform group-hover:-translate-x-0.5" />
                    ) : (
                      <LogIn className="size-5 transition-transform group-hover:translate-x-0.5" />
                    )}
                    <span className="tracking-wide uppercase">
                      {isClockedIn ? 'Time Out' : 'Time In'}
                    </span>
                  </div>

                  {/* High-Tech Switch Track Visual */}
                  <div className="flex items-center gap-2 bg-black/30 rounded-full px-3 py-1.5 text-[11px] font-mono font-semibold">
                    <span>{isClockedIn ? 'ACTIVE' : 'READY'}</span>
                    <span className={cn(
                      'size-2.5 rounded-full',
                      isClockedIn ? 'bg-amber-300 animate-ping' : 'bg-emerald-300 animate-ping'
                    )} />
                  </div>
                </button>
                <span className="text-[10px] font-mono text-copy-muted">
                  {isClockedIn ? 'Click to submit shift time out' : 'Click to stamp time in on Asia/Manila clock'}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Journal Card */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Daily journal</h3>
                <p className="text-xs text-copy-muted mt-0.5">
                  Describe what tasks you completed today and any blockers for your supervisor.
                </p>
              </div>
              <span className="text-[11px] font-mono text-copy-muted">
                Min 30 words required
              </span>
            </div>

            <textarea
              rows={3}
              value={journalInput}
              onChange={(e) => setJournalInput(e.target.value)}
              placeholder="What did you work on today? (e.g., Developed the mobile bottom navigation bar, tested keyboard accessibility, resolved student application filters...)"
              className="w-full p-4 rounded-xl border border-border bg-surface text-ink text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-colors"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-xs text-copy-muted flex items-center gap-1.5">
                <Coffee className="size-3.5" />
                <span>1.0 hr lunch break is standard and automatically deducted</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setJournalSubmitted(true);
                  showToast('Daily journal submitted to supervisor queue');
                }}
                className={cn(
                  'h-10 px-5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs',
                  focusStyle
                )}
              >
                <Send className="size-3.5" />
                <span>{journalSubmitted ? 'Submitted' : 'Submit to supervisor'}</span>
              </button>
            </div>
          </div>

          {/* Recent Attendance Logs Table */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Recent attendance logs</h3>
                <p className="text-xs text-copy-muted mt-0.5">
                  Your official shift records recorded and audited server-side in Asia/Manila.
                </p>
              </div>
              <span className="text-[11px] font-mono text-copy-muted">
                Showing last 4 entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold text-copy-muted uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Time in</th>
                    <th className="py-3 px-3">Time out</th>
                    <th className="py-3 px-3">Break</th>
                    <th className="py-3 px-3 text-right">Net hours</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {studentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3.5 px-3 font-medium text-ink">{log.date}</td>
                      <td className="py-3.5 px-3 text-copy-muted tabular-nums">{log.timeIn}</td>
                      <td className="py-3.5 px-3 text-copy-muted tabular-nums">{log.timeOut}</td>
                      <td className="py-3.5 px-3 text-copy-muted tabular-nums">{log.breakDuration}</td>
                      <td className="py-3.5 px-3 font-bold text-ink text-right tabular-nums">
                        {log.netHours.toFixed(1)} hrs
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold',
                            log.status === 'approved'
                              ? 'bg-success-tint text-success-text'
                              : log.status === 'pending'
                              ? 'bg-warning-tint text-warning-text'
                              : 'bg-error-tint text-error-text'
                          )}
                        >
                          {log.status === 'approved'
                            ? 'Approved'
                            : log.status === 'pending'
                            ? 'Pending approval'
                            : 'Needs revision'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => showToast(`Journal: "${log.journal}"`)}
                          className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                        >
                          View journal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          SCREEN B: THE COORDINATOR & SUPERVISOR DECK
          ────────────────────────────────────────────────────────────────────── */}
      {activeRole === 'coordinator' && (
        <div className="space-y-6">
          {/* Header & Metrics Strip */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  OJT Management & Approvals
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-ink mt-1">
                  Supervisor & Coordinator Deck
                </h2>
                <p className="text-xs text-copy-muted mt-0.5">
                  Review student daily shift submissions, verify daily journals, and authorize hours accumulation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-warning-tint text-warning-text border border-warning-border">
                  {pendingList.length} submissions pending review
                </span>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border">
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-copy-muted font-medium">Active students</div>
                <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">18</div>
                <div className="text-[10px] text-success mt-0.5 font-medium">All deployed in partners</div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-copy-muted font-medium">Total hours verified</div>
                <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">1,420.5</div>
                <div className="text-[10px] text-copy-muted mt-0.5">Approved towards BSIT targets</div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-copy-muted font-medium">Pending approvals</div>
                <div className="text-2xl font-extrabold text-warning-text mt-1 tabular-nums">
                  {pendingList.length}
                </div>
                <div className="text-[10px] text-warning mt-0.5 font-medium">Awaiting supervisor signoff</div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-copy-muted font-medium">Stale logs (&gt;3 days)</div>
                <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">0</div>
                <div className="text-[10px] text-success mt-0.5 font-medium">Zero backlogged entries</div>
              </div>
            </div>
          </div>

          {/* Pending Submissions Queue */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Pending student daily logs</h3>
                <p className="text-xs text-copy-muted mt-0.5">
                  Review time entries and journal descriptions before authorizing hours accumulation.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-warning-text">
                {pendingList.length} items awaiting review
              </span>
            </div>

            {pendingList.length === 0 ? (
              <div className="py-12 text-center text-copy-muted space-y-2">
                <CheckCircle2 className="size-8 text-success mx-auto" />
                <p className="text-sm font-semibold text-ink">All caught up!</p>
                <p className="text-xs">No pending student shift logs in queue.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl border border-border bg-surface/40 hover:bg-surface/80 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-primary-tint text-primary font-bold text-xs flex items-center justify-center">
                          {item.studentName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="font-bold text-ink text-sm flex items-center gap-2">
                            <span>{item.studentName}</span>
                            <span className="text-[11px] font-normal text-copy-muted">
                              ({item.studentId} • {item.section})
                            </span>
                          </div>
                          <div className="text-xs text-copy-muted flex items-center gap-1.5 mt-0.5">
                            <Building2 className="size-3" />
                            <span>{item.company}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
                        <span className="text-copy-muted">{item.date}</span>
                        <span className="text-border-strong">•</span>
                        <span className="text-ink font-bold">{item.timeIn} – {item.timeOut}</span>
                        <span className="px-2 py-0.5 rounded-md bg-primary-tint text-primary font-bold">
                          {item.netHours.toFixed(1)} hrs
                        </span>
                      </div>
                    </div>

                    {/* Daily Journal Excerpt */}
                    <div className="p-3.5 rounded-xl bg-card border border-border text-xs text-ink leading-relaxed">
                      <div className="text-[10px] font-semibold text-copy-muted uppercase mb-1">
                        Daily journal submission:
                      </div>
                      <p>&ldquo;{item.journal}&rdquo;</p>
                    </div>

                    {/* Actions: Approve & Reject */}
                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setRejectingItem(item)}
                        className="h-9 px-4 rounded-xl border border-border hover:bg-error-tint hover:border-error-border text-error-text text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                        <span>Request revision</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(item.id, item.studentName)}
                        className="h-9 px-5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Check className="size-3.5" />
                        <span>Approve 8.0 hrs</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          REJECTION / REVISION MODAL
          ────────────────────────────────────────────────────────────────────── */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-ink">Request shift log revision</h4>
                <p className="text-xs text-copy-muted mt-0.5">
                  Explain to {rejectingItem.studentName} why this entry needs correction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="text-copy-muted hover:text-ink cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-copy-muted">Reason for revision:</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Daily journal is under the 30-word minimum, or departure timestamp does not match company biometric logs."
                className="w-full p-3 rounded-xl border border-border bg-surface text-ink text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="h-9 px-4 rounded-xl border border-border hover:bg-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                className="h-9 px-4 rounded-xl bg-error hover:bg-[#b91c1c] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Send revision request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
