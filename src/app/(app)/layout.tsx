import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import {
  getApprovalQueue, getCranes, getCurrentCycle, getCycles, getUsers,
} from "@/lib/firm/api";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { DashboardOverlays } from "@/components/dashboard/dashboard-overlays";
import { buCodeForUser } from "@/lib/firm/bu";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [cycle, cycles, queue, craneResult, users] = await Promise.all([
    getCurrentCycle(),
    getCycles(),
    getApprovalQueue(user.role),
    getCranes({ role: user.role, buCode: buCodeForUser(user) }),
    getUsers(),
  ]);

  const shellUser = {
    name: user.name,
    email: user.email,
    role: user.role,
    designation: user.designation,
  };

  return (
    <div className="app-canvas min-h-screen">
      <Sidebar user={shellUser} pendingApprovals={queue.length} />
      <div className="lg:pl-[var(--firm-sidebar-w,252px)]">
        <TopBar user={shellUser} cycle={cycle} cycles={cycles} />
        <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
        <footer className="mx-auto flex max-w-[1680px] items-center justify-end border-t border-line px-4 py-5 text-[12px] text-muted sm:px-6 lg:px-8">
          <span>FIRM · Fleet exit cycle · Sanghvi Movers Limited</span>
        </footer>
      </div>
      <Suspense fallback={null}>
        <DashboardOverlays
          cranes={craneResult.rows}
          users={users}
          cycleId={cycle?.id ?? ""}
          role={user.role}
          userName={user.name}
        />
      </Suspense>
    </div>
  );
}
