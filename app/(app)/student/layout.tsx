import { StudentHeader, StudentTabs } from "@/components/student/student-header";
import { requireRole } from "@/lib/auth/server";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["student"]);
  return (
    <div className="flex min-h-screen flex-col bg-page-wash">
      <StudentHeader />
      <main
        id="main"
        className="mx-auto flex w-[min(100%-32px,1100px)] flex-1 flex-col gap-6 pb-28 pt-6 sm:pb-10 sm:pt-8"
      >
        {children}
      </main>
      <StudentTabs />
    </div>
  );
}
