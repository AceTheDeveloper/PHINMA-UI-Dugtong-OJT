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
        className="mx-auto flex w-[min(100%-32px,1100px)] flex-1 flex-col gap-6 pb-10 pt-6 sm:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
