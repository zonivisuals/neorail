import { requireRole } from "@/lib/auth/auth-guard";

export default async function ConductorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only allow CONDUCTOR users
  await requireRole(["CONDUCTOR"]);
  
  return (
    <div className="dark bg-neutral-950 text-neutral-300 h-screen w-screen overflow-hidden flex antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {children}
    </div>
  );
}
