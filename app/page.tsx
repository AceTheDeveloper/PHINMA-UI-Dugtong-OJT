import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import ScrollReveal from "./components/scroll-reveal";

function Logo() {
  return (
    <Image
      src="/dugtong-logo.png"
      alt="Dugtong OJT"
      width={48}
      height={48}
      className="brand-mark"
      priority
    />
  );
}

function HeroSample() {
  return (
    <div className="hero-visual" role="img" aria-label="Sample data showing a coordinator dashboard and a student's daily log">
      <div className="dashboard-card">
        <div className="dashboard-top">
          <div>
            <p className="eyebrow">Coordinator view</p>
            <p className="dashboard-title">Student progress</p>
          </div>
          <span className="dashboard-date">Today</span>
        </div>
        <div className="dashboard-summary">
          <div>
            <span>Approved hours</span>
            <strong>126 <small>/ 486</small></strong>
          </div>
          <div className="summary-rule" />
          <div>
            <span>Pending review</span>
            <strong>04 <small>entries</small></strong>
          </div>
        </div>
        <div className="dashboard-table">
          <div className="table-heading">
            <span>Student</span>
            <span>Status</span>
          </div>
          <div className="dashboard-row">
            <span className="student-name">
              <span className="avatar avatar-blue">MR</span>
              Mara Reyes
            </span>
            <span className="status status-approved">Approved</span>
          </div>
          <div className="dashboard-row">
            <span className="student-name">
              <span className="avatar avatar-teal">JL</span>
              Julian Lim
            </span>
            <span className="status status-pending">Pending</span>
          </div>
          <div className="dashboard-row">
            <span className="student-name">
              <span className="avatar avatar-slate">AC</span>
              Alex Cruz
            </span>
            <span className="status status-approved">Approved</span>
          </div>
        </div>
      </div>

      <div className="phone-frame">
        <div className="phone-speaker" />
        <div className="phone-screen">
          <div className="phone-header">
            <Logo />
            <span>Daily log</span>
            <span className="phone-menu" aria-hidden="true">•••</span>
          </div>
          <div className="phone-content">
            <p className="eyebrow">Today, October 12</p>
            <p className="phone-greeting">Hello, Mara</p>
            <div className="time-card">
              <span>Time in</span>
              <strong className="mono">08:02 AM</strong>
            </div>
            <div className="status status-pending phone-status">
              <span className="status-dot" />
              Pending approval
            </div>
            <div className="phone-progress">
              <div className="progress-heading">
                <span>Hours progress</span>
                <strong>126 / 486</strong>
              </div>
              <div className="progress-track">
                <span />
              </div>
              <p>Approved hours</p>
            </div>
            <div className="journal-preview">
              <span>Daily journal</span>
              <div className="journal-lines">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepFragment({ type }: { type: "time" | "approval" | "progress" }) {
  if (type === "time") {
    return (
      <div className="fragment fragment-time" aria-hidden="true">
        <span className="fragment-label">Time in</span>
        <strong className="mono">08:02 AM</strong>
        <span className="fragment-live" />
      </div>
    );
  }

  if (type === "approval") {
    return (
      <div className="fragment fragment-approval" aria-hidden="true">
        <span className="avatar avatar-teal">JL</span>
        <span className="fragment-person">Julian Lim</span>
        <span className="status status-pending">Pending</span>
      </div>
    );
  }

  return (
    <div className="fragment fragment-progress" aria-hidden="true">
      <div className="progress-heading">
        <span>Approved hours</span>
        <strong>126 / 486</strong>
      </div>
      <div className="progress-track">
        <span />
      </div>
    </div>
  );
}

function StudentPanel() {
  return (
    <div className="role-panel student-panel" aria-hidden="true">
      <div className="panel-heading">
        <span>My hours</span>
        <span className="panel-period">This term</span>
      </div>
      <div className="panel-total">
        <strong>126</strong>
        <span>approved hours</span>
      </div>
      <div className="progress-track">
        <span />
      </div>
      <div className="panel-foot">
        <span>Progress toward requirement</span>
        <span>26%</span>
      </div>
    </div>
  );
}

function SupervisorPanel() {
  return (
    <div className="role-panel supervisor-panel" aria-hidden="true">
      <div className="panel-heading">
        <span>Today&apos;s entries</span>
        <span className="status status-pending">2 pending</span>
      </div>
      <div className="review-row">
        <span className="avatar avatar-blue">MR</span>
        <span className="review-name">Mara Reyes</span>
        <span className="mono review-time">08:02</span>
      </div>
      <div className="review-row">
        <span className="avatar avatar-teal">JL</span>
        <span className="review-name">Julian Lim</span>
        <span className="mono review-time">08:11</span>
      </div>
      <div className="review-action">
        <span className="review-check"><Check size={14} strokeWidth={2.5} /></span>
        Approve all
      </div>
    </div>
  );
}

function CoordinatorPanel() {
  return (
    <div className="role-panel coordinator-panel" aria-hidden="true">
      <div className="panel-heading">
        <span>Progress overview</span>
        <span className="panel-period">All students</span>
      </div>
      <div className="coordinator-line">
        <span className="avatar avatar-slate">AC</span>
        <span className="coordinator-name">Alex Cruz</span>
        <span className="mini-progress"><i /></span>
      </div>
      <div className="coordinator-line">
        <span className="avatar avatar-blue">MR</span>
        <span className="coordinator-name">Mara Reyes</span>
        <span className="mini-progress"><i /></span>
      </div>
      <div className="coordinator-line">
        <span className="avatar avatar-teal">JL</span>
        <span className="coordinator-name">Julian Lim</span>
        <span className="mini-progress"><i /></span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand-link" href="/" aria-label="Dugtong OJT home">
            <Logo />
            <span>Dugtong</span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#who-its-for">Who it&apos;s for</a>
          </nav>
          <a className="button button-outline header-signin" href="/sign-in">Sign in</a>
        </div>
      </header>

      <ScrollReveal />
      <main id="main-content">
        <section className="hero-section">
          <div className="content-width hero-grid">
            <div className="hero-copy" data-reveal>
              <h1>Replace the paper DTR.</h1>
              <p className="hero-description">
                Students log their hours and a short daily journal. Supervisors approve them the same day. Coordinators see every student&apos;s progress without chasing signatures.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="/sign-in">Sign in</a>
                <a className="text-link" href="#how-it-works">
                  See how it works <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="hero-note">Accounts are created by your school.</p>
            </div>
            <div className="hero-product" data-reveal>
              <HeroSample />
              <p className="sample-caption">Sample data</p>
            </div>
          </div>
        </section>

        <section className="section how-section" id="how-it-works" data-reveal>
          <div className="content-width">
            <div className="section-heading">
              <p className="eyebrow">How it works</p>
              <h2>From a day&apos;s work to approved hours</h2>
            </div>
            <div className="steps-rail">
              <article className="step">
                <div className="step-marker"><span>01</span></div>
                <StepFragment type="time" />
                <h3>Log the day.</h3>
                <p>Students time in, time out, and write a short journal. The time comes from the server, not the phone.</p>
              </article>
              <article className="step">
                <div className="step-marker"><span>02</span></div>
                <StepFragment type="approval" />
                <h3>Approve it daily.</h3>
                <p>The company supervisor approves the entry, rejects it with a reason, or corrects the times.</p>
              </article>
              <article className="step">
                <div className="step-marker"><span>03</span></div>
                <StepFragment type="progress" />
                <h3>Hours add up.</h3>
                <p>Only approved hours count. When the required hours are met, the supervisor submits an evaluation and the certification is generated.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section roles-section" id="who-its-for">
          <div className="content-width">
            <div className="section-heading" data-reveal>
              <p className="eyebrow">Who it&apos;s for</p>
            </div>
            <div className="role-row" data-reveal>
              <div className="role-copy">
                <p className="role-label">Students</p>
                <h2>See your hours at a glance.</h2>
                <p>Track approved hours against your requirement, read your journal history, and get your certification when you finish.</p>
              </div>
              <StudentPanel />
            </div>
            <div className="role-row role-row-reverse" data-reveal>
              <div className="role-copy">
                <p className="role-label">Supervisors</p>
                <h2>Approve in one pass.</h2>
                <p>Review the day&apos;s entries together, approve them in bulk, and evaluate students when their hours are complete.</p>
              </div>
              <SupervisorPanel />
            </div>
            <div className="role-row" data-reveal>
              <div className="role-copy">
                <p className="role-label">Coordinators</p>
                <h2>Know where everyone stands.</h2>
                <p>See every student&apos;s progress, spot approvals that are stuck, and export records and printable DTRs.</p>
              </div>
              <CoordinatorPanel />
            </div>
          </div>
        </section>

        <section className="records-section" data-reveal>
          <div className="content-width records-inner">
            <div className="section-heading">
              <h2>Records you can rely on</h2>
            </div>
            <ul className="records-list">
              <li><Check aria-hidden="true" size={17} /><span>Approved entries are locked. Reopening one is recorded.</span></li>
              <li><Check aria-hidden="true" size={17} /><span>Every approval, correction, and rejection is kept with who made it and when.</span></li>
              <li><Check aria-hidden="true" size={17} /><span>Students see only their own hours.</span></li>
              <li><Check aria-hidden="true" size={17} /><span>Files stay private.</span></li>
              <li><Check aria-hidden="true" size={17} /><span>Built to follow the Data Privacy Act of 2012.</span></li>
            </ul>
          </div>
        </section>

        <section className="cta-section" data-reveal>
          <div className="content-width cta-inner">
            <div>
              <h2>Already have an invitation?</h2>
              <p>Sign in with the email your school has on file.</p>
            </div>
            <a className="button button-cta" href="/sign-in">Sign in</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="content-width footer-inner">
          <Link className="brand-link footer-brand" href="/" aria-label="Dugtong OJT home">
            <Logo />
            <span>Dugtong</span>
          </Link>
          <a className="footer-signin" href="/sign-in">Sign in</a>
          <p>2026 Dugtong OJT</p>
        </div>
      </footer>
    </>
  );
}
