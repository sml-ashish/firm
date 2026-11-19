import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, CircleAlert, ClipboardCheck, LockKeyhole, Truck,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getApprovalQueue, getDashboard } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { HeroStrip } from "@/components/dashboard/hero-strip";
import { MyQueue } from "@/components/dashboard/my-queue";
import { ExecutionTable } from "@/components/dashboard/execution-table";
import { PipelineFlow } from "@/components/dashboard/pipeline-flow";
import { ConflictsPanel } from "@/components/dashboard/conflicts-panel";
import { ActivityFeed, type ActivityEntry } from "@/components/dashboard/activity-feed";
import { ROLE_MAP, STATUS_MAP, type Role } from "@/lib/firm/workflow";

export const dynamic = "force-dynamic";

const dayMs = 86_400_000;

export default async function DashboardPage() {
  const user = await requireUser();
  if (["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "BU", "CSO", "SCM", "CBO"].includes(user.role)) redirect("/cranes");
  const [data, queue] = await Promise.all([getDashboard(), getApprovalQueue(user.role)]);
  const role = ROLE_MAP[user.role as Role];

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const daysToEvaluation = data.cycle
    ? Math.round((new Date(`${data.cycle.evaluationDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / dayMs)
    : null;

  const conflicts = data.conflicts;
  const approvals = data.approvals;
  const healthScore = Math.max(0, 100 - conflicts * 12 - approvals * 4);
  const healthReason = conflicts > 0
    ? `${conflicts} conflict${conflicts === 1 ? "" : "s"} need a decision in 3 days.`
    : approvals > 0
      ? `${approvals} crane${approvals === 1 ? "" : "s"} awaiting a named approval.`
      : "No conflicts or approvals blocking the cycle.";

  const queueWithDays = queue.map((item) => {
    const times = item.crane.audit.map((entry) => new Date(entry.at).getTime()).filter((value) => !Number.isNaN(value));
    const latest = times.length ? Math.max(...times) : now.getTime();
    return { ...item, days: Math.max(0, Math.min(9, Math.round((now.getTime() - latest) / dayMs))) };
  });

  const executionRows = data.cranes
    .filter((crane) => crane.sap.soEnd)
    .map((crane) => ({
      id: crane.id,
      equipmentId: crane.equipmentId,
      soNumber: crane.sap.soNumber ?? "—",
      soEnd: crane.sap.soEnd as string,
      daysLeft: Math.round((new Date(`${crane.sap.soEnd}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / dayMs),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  const activeCount = data.byStatus.filter((entry) => STATUS_MAP[entry.code].type === "Active").reduce((sum, entry) => sum + entry.count, 0);
  const readOnly = ["BU", "MARKETING", "SCM", "FPNA"].includes(user.role);

  const activity: ActivityEntry[] = data.cranes
    .flatMap((crane) => crane.audit.map((entry) => ({
      id: entry.id,
      at: entry.at,
      actor: entry.actor,
      action: entry.action,
      detail: entry.detail,
      craneId: crane.id,
      equipmentId: crane.equipmentId,
    })))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader
        eyebrow="FIRM cycle"
        title="Cycle dashboard"
        description={`What needs your decision, what is at risk, and what changed — ${role?.name ?? user.role}.`}
        actions={
          <>
            <Link href="/cranes" className="btn btn-secondary"><Truck size={14} /> Crane register</Link>
            <Link href="/approvals" className="btn btn-primary">
              <ClipboardCheck size={14} /> My approvals
              {queue.length > 0 && (
                <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-white/25 px-1 text-[12px] font-bold tabular-nums">
                  {queue.length}
                </span>
              )}
            </Link>
          </>
        }
      />



      <div className="mt-4">
      <HeroStrip
        cycle={data.cycle}
        daysToEvaluation={daysToEvaluation}
        healthScore={healthScore}
        healthReason={healthReason}
        byStatus={data.byStatus}
        total={data.total}
      />
      </div>

      <div className="mt-4">
        <MyQueue items={queueWithDays} role={user.role} readOnly={readOnly} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Cranes in cycle" value={data.total} sub="All statuses" icon={<Truck size={16} />} tone="brand" href="/cranes" />
        <KpiCard label="Active" value={activeCount} sub="Moving through a layer" icon={<ArrowRight size={16} />} tone="brand" href="/cranes?type=Active" />
        <KpiCard label="Awaiting approval" value={approvals} sub="Named approver assigned" icon={<ClipboardCheck size={16} />} tone="warning" href="/approvals" />
        <KpiCard
          label="Conflicts"
          value={conflicts}
          sub="S14 · decision within 3 working days"
          icon={<CircleAlert size={16} />}
          tone={conflicts > 0 ? "danger" : "neutral"}
          href="/cranes?status=S14"
          urgent={conflicts > 0}
        />
        <KpiCard label="Locked in SAP" value={data.locked} sub="Cannot be claimed back" icon={<LockKeyhole size={16} />} tone="violet" href="/cranes?type=Locked" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 min-[1440px]:col-span-8">
          <PipelineFlow counts={data.byStatus} />
        </div>
        <div className="space-y-4 lg:col-span-5 min-[1440px]:col-span-4">
          <ConflictsPanel cranes={data.cranes.filter((crane) => crane.status === "S14")} />
        </div>
      </div>

      <div className="mt-4">
        <ActivityFeed entries={activity} />
      </div>

      <div className="mt-4">
        <ExecutionTable rows={executionRows} />
      </div>
    </>
  );
}
