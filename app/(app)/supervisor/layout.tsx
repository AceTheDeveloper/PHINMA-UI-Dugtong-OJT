import { SupervisorHeader } from "@/components/supervisor/supervisor-header";
import { requireRole } from "@/lib/auth/server";

export default async function SupervisorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["supervisor"]);
  return (
    <div className="flex min-h-screen flex-col bg-page-wash">
      <SupervisorHeader />
      <main
        id="main"
        className="mx-auto flex w-[min(100%_-_32px,1100px)] flex-1 flex-col gap-6 py-6"
      >
        {children}
      </main>
    </div>
  );
}
