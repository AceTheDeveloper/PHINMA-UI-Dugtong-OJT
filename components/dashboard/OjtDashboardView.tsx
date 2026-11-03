'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  ArrowRight,
  Send,
  FileText,
  Check,
  X,
  Coffee,
  GraduationCap,
  Users,
  Briefcase,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { HoursChain } from '@/components/ui/hours-chain';
import { cn } from '@/lib/utils';
import { focusStyle } from '@/components/brand-link';

/* ────────────────────────────────────────────────────────────────────────────
 * DUGTONG OJT — PROFESSIONAL ACADEMIC / HR DASHBOARD
 *
 * Designed with Portfolio & Cortex aesthetic (sleek navy/slate cards, subtle glowing
 * borders, tabular numerals, clean sans-serif typography) tailored 100% to real OJT:
 *   Screen A: The Student Portal (Time in/out, Daily Journal, Timesheet, Hours Chain)
 *   Screen B: The Coordinator & Supervisor Approval Deck (Approvals, Metrics, Revision Modal)
 * ──────────────────────────────────────────────────────────────────────────── */

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

  // ── STUDENT STATE ──
  const [isClockedIn, setIsClockedIn] = useState<boolean>(true);
  const [clockInTime, setClockInTime] = useState<string>('08:00 AM');
  const [journalInput, setJournalInput] = useState<string>(
    'Implemented responsive modal dialogs and fixed mobile tap target constraints for student applications. Verified contrast compliance under dark mode.'
  );
  const [journalSubmitted, setJournalSubmitted] = useState<boolean>(false);

  // Student progress numbers
  const requiredHours = 486.0;
  const approvedHours = 212.0;
  const pendingHours = 8.0;
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
      journal: 'Active shift in progress at Western Visayas Tech Partners Inc.',
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
      company: 'Western Visayas Tech Partners Inc.',
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
      company: 'Iloilo Digital Innovations Hub',
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
      company: 'Panay Cloud Solutions Corp.',
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
      {/* ── ROLE SWITCHER TAB STRIP ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-copy-muted">
            Interactive OJT Experience
          </span>
          <span className="text-xs text-border-strong">•</span>
          <span className="text-xs font-bold text-ink">
            {activeRole === 'student' ? 'Student View' : 'Supervisor & Coordinator Deck'}
          </span>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-card border border-border">
          <button
            type="button"
            onClick={() => setActiveRole('student')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeRole === 'student'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-copy-muted hover:text-ink'
            )}
          >
            <GraduationCap className="size-3.5" />
            <span>Student portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRole('coordinator')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeRole === 'coordinator'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-copy-muted hover:text-ink'
            )}
          >
            <Briefcase className="size-3.5" />
            <span>Supervisor deck</span>
            {pendingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning text-warning-text font-bold">
                {pendingList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-ink text-surface border border-border-strong shadow-lg flex items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="size-4 text-success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SCREEN A: THE STUDENT DASHBOARD
          ══════════════════════════════════════════════════════════════════════ */}
      {activeRole === 'student' && (
        <div className="space-y-6">
          {/* Header & Hours Chain Progress Card */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
                  <span>PHINMA UI // College of Information Technology Education</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-ink mt-1">
                  Hello, Neil Alisasis.
                </h2>
                <p className="text-xs text-copy-muted mt-0.5">
                  BSIT Practicum • Western Visayas Tech Partners Inc. (Supervisor: Engr. M. Ramos)
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

            {/* Signature Hours Chain Visualizer */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs font-medium mb-3">
                <span className="text-copy-muted">OJT Hours completion progress</span>
                <span className="font-bold text-ink tabular-nums">
                  {approvedHours.toFixed(1)} / {requiredHours.toFixed(1)} hrs ({percentage}%)
                </span>
              </div>

              {/* Dugtong Hours Chain: One link per 40 hours */}
              <div className="py-2 overflow-x-auto">
                <HoursChain approvedHours={approvedHours} requiredHours={requiredHours} size="md" />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-copy-muted">
                <span>1 link = 40 approved hours</span>
                <span className="tabular-nums font-semibold text-primary">
                  {remainingHours.toFixed(1)} hrs remaining for graduation clearance
                </span>
              </div>
            </div>
          </div>

          {/* Action Center (Hero Card: Time In & Time Out) */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Live Time & Shift Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-copy-muted font-medium">
                  <Calendar className="size-3.5 text-primary" />
                  <span>Tuesday, November 3, 2026 • Asia/Manila Server Clock</span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-ink tabular-nums">
                    08:32:15 AM
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                      isClockedIn
                        ? 'bg-success-tint text-success-text'
                        : 'bg-surface text-copy-muted'
                    )}
                  >
                    {isClockedIn ? 'Currently clocked in' : 'Not clocked in'}
                  </span>
                </div>

                <p className="text-xs text-copy-muted leading-relaxed max-w-md">
                  {isClockedIn
                    ? `Timed in at ${clockInTime}. Net shift duration: 3h 12m (lunch break deducted automatically).`
                    : 'Ready to start your shift. Click Time in to begin logging.'}
                </p>
              </div>

              {/* Right: Big Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsClockedIn(true);
                    setClockInTime('08:00 AM');
                    showToast('Timed in at 08:00 AM (Asia/Manila server time)');
                  }}
                  disabled={isClockedIn}
                  className={cn(
                    'h-12 min-w-[140px] px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                    isClockedIn
                      ? 'bg-surface text-disabled border border-border cursor-not-allowed opacity-60'
                      : 'bg-primary hover:bg-primary-hover text-primary-foreground shadow-xs',
                    focusStyle
                  )}
                >
                  <Clock className="size-4" />
                  <span>Time in</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsClockedIn(false);
                    showToast('Timed out at 05:00 PM. Please complete your daily journal.');
                  }}
                  disabled={!isClockedIn}
                  className={cn(
                    'h-12 min-w-[140px] px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                    !isClockedIn
                      ? 'bg-surface text-disabled border border-border cursor-not-allowed opacity-60'
                      : 'bg-error hover:bg-[#b91c1c] text-white shadow-xs',
                    focusStyle
                  )}
                >
                  <Clock className="size-4" />
                  <span>Time out</span>
                </button>
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

            <div className="flex items-center justify-between pt-1">
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
                  'h-10 px-5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs',
                  focusStyle
                )}
              >
                <Send className="size-3.5" />
                <span>{journalSubmitted ? 'Submitted' : 'Submit to supervisor'}</span>
              </button>
            </div>
          </div>

          {/* Recent Logs (Timesheet View) */}
          <div className="p-7 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Recent attendance logs</h3>
                <p className="text-xs text-copy-muted mt-0.5">
                  Your official shift records recorded and audited server-side in Asia/Manila.
                </p>
              </div>

              <span className="text-xs font-semibold text-copy-muted">
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

      {/* ══════════════════════════════════════════════════════════════════════
          SCREEN B: THE COORDINATOR & SUPERVISOR DECK
          ══════════════════════════════════════════════════════════════════════ */}
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

          {/* Pending Submissions Queue (Actionable Cards over Plain Tables) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">
                Pending student submissions ({pendingList.length})
              </h3>
              <span className="text-xs text-copy-muted">
                Review daily journal before approving shift hours
              </span>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-12 rounded-2xl bg-card border border-border text-center space-y-2">
                <CheckCircle2 className="size-8 text-success mx-auto" />
                <h4 className="text-base font-bold text-ink">All caught up!</h4>
                <p className="text-xs text-copy-muted">
                  There are no pending student shift logs waiting for review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 rounded-2xl bg-card border border-border shadow-xs hover:border-border-strong transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary-tint text-primary font-bold text-xs flex items-center justify-center">
                          {item.studentName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-ink">{item.studentName}</div>
                          <div className="text-xs text-copy-muted">
                            {item.section} • {item.studentId}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-primary">
                          {item.company}
                        </span>
                        <div className="text-[11px] text-copy-muted">
                          {item.date} • {item.timeIn} — {item.timeOut} ({item.netHours.toFixed(1)} hrs)
                        </div>
                      </div>
                    </div>

                    {/* Journal Snippet */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                      <div className="text-[11px] font-semibold text-copy-muted uppercase tracking-wider">
                        Daily journal reflection:
                      </div>
                      <p className="text-xs text-ink leading-relaxed">&ldquo;{item.journal}&rdquo;</p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingItem(item);
                          setRejectionReason('');
                        }}
                        className={cn(
                          'h-9 px-4 rounded-lg border border-error-border text-error hover:bg-error-tint/40 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
                          focusStyle
                        )}
                      >
                        <X className="size-3.5" />
                        <span>Reject / Request revision</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(item.id, item.studentName)}
                        className={cn(
                          'h-9 px-5 rounded-lg bg-success hover:bg-[#066245] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs',
                          focusStyle
                        )}
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

          {/* Rejection Modal Dialog */}
          {rejectingItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h4 className="text-base font-bold text-ink">
                    Request shift revision for {rejectingItem.studentName}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setRejectingItem(null)}
                    className="p-1 rounded-lg text-copy-muted hover:text-ink cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <p className="text-xs text-copy-muted leading-relaxed">
                  Per <strong>AGENTS.md §6</strong>, rejecting an entry requires a clear explanation so the student knows what to adjust and resubmit.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink">
                    Reason for return / requested correction:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., Left at 16:00 for offsite seminar; please adjust net hours to 7.0 and add seminar details to your journal."
                    className="w-full p-3 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectingItem(null)}
                    className="h-9 px-4 rounded-lg border border-border hover:bg-surface text-copy-muted text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    disabled={!rejectionReason.trim()}
                    className="h-9 px-4 rounded-lg bg-error hover:bg-[#b91c1c] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Return entry to student
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
