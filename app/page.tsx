import React from 'react';
import DtrPipelineBreakdown from '../components/DtrPipelineBreakdown';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafe] text-[#0f172a] flex flex-col font-sans">
      {/* ── TOP HEADER & NAVIGATION ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#eceef2] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* PHINMA UI Brand Mark */}
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            UI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">Dugtong OJT</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e6eefe] text-[#2563eb]">
                Pilot // CITE BSIT
              </span>
            </div>
            <p className="text-[11px] text-[#596579]">
              PHINMA University of Iloilo — On-the-Job Training Portal
            </p>
          </div>
        </div>

        {/* User Role / Navigation Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f5f7fa] border border-[#eceef2] text-xs font-medium text-[#596579]">
            <span className="w-2 h-2 rounded-full bg-[#087a55]" />
            <span>Role: Student</span>
            <span>•</span>
            <span className="text-[#0f172a] font-semibold">Neil (UI/UX)</span>
          </div>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            Time in
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#2563eb]">
            Attendance and DTR Verification
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
            Daily Time Record & Progress Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#596579] max-w-3xl leading-relaxed">
            Record shifts, submit daily journals, and track your graduation hours against the 486.0-hour course requirement.
            All hours are authoritative and audited server-side in the Asia/Manila timezone.
          </p>
        </div>

        {/* ── THE INTERACTIVE DTR VERIFICATION PIPELINE ── */}
        <DtrPipelineBreakdown />
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#eceef2] bg-white py-6 px-6 mt-12 text-xs text-[#596579]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © 2026 PHINMA University of Iloilo — College of Information Technology Education (CITE)
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>BSIT Practicum Program</span>
            <span>•</span>
            <span>AGENTS.md Compliance Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
