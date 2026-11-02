import type { Metadata } from "next";
import { LoadError, PageHeader, Section } from "@/components/admin/admin-parts";
import { HistorySection } from "@/components/admin/history-section";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSchoolSettings } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Settings | Dugtong OJT",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);
  const result = await getSchoolSettings();

  if (!result.ok) {
    return <LoadError message={result.error.message} />;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="School parameters and data privacy compliance configuration."
      />

      <Section
        title="School details"
        description="Parameters applied system-wide across all departments, courses, and daily entries."
      >
        <SettingsForm initialSettings={result.data} />
      </Section>

      <Section
        title="Data privacy compliance"
        description="Philippine Data Privacy Act of 2012 (RA 10173)"
      >
        <div className="grid max-w-prose gap-3 text-sm text-muted-foreground">
          <p>
            Student data in Dugtong OJT is collected solely for OJT monitoring, attendance verification,
            and certification requirements under university and CHED guidelines.
          </p>
          <p>
            When school administration or legal counsel updates the privacy terms, increment the
            <strong className="text-ink"> Consent notice version</strong> above (e.g., from{" "}
            <code className="text-xs font-semibold text-ink">v1</code> to{" "}
            <code className="text-xs font-semibold text-ink">v2</code>).
            All active students, coordinators, and supervisors will be required to review and accept
            the revised notice immediately upon their next sign-in before accessing any OJT data.
          </p>
        </div>
      </Section>

      <HistorySection
        filter={{ tables: ["school_settings"] }}
        description="Changes to school parameters and privacy notice versions."
      />
    </>
  );
}
