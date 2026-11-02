import { StudentHeader } from "@/components/student/student-header";
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
        className="mx-auto flex w-[min(100%_-_32px,1100px)] flex-1 flex-col gap-6 py-6"
      >
        {children}
      </main>
    </div>
  );
}
