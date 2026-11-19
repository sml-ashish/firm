import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCycles, getCranes } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { CycleSettingsForm } from "@/components/cycle-settings-form";
import { STATUSES, STATUS_MAP } from "@/lib/firm/workflow";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [cycles, all] = await Promise.all([getCycles(), getCranes({ cycleId: id })]);
  const cycle = cycles.find((entry) => entry.id === id);
  if (!cycle) notFound();
  const canManageCycle = user.role === "FPNA" || user.role === "GLOBAL_ADMIN";
  const isFpna = user.role === "FPNA";
  const isReviewerTeam = user.role === "SALES" || user.role === "MAINTENANCE";
  const hideAnalytics = isFpna || isReviewerTeam;

  return (
    <>
      <Link href="/cycles" className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline">
        <ArrowLeft size={13} /> All cycles
      </Link>
      <PageHeader
        eyebrow={`Cycle ${cycle.id}`}
        title={cycle.name}
        actions={user.role === "FPNA" || user.role === "GLOBAL_ADMIN" ? (isFpna ? undefined : <Link href="/import" className="btn btn-secondary">Upload fleet</Link>) : undefined}
      />

      <div className="card mb-4 p-4">
        <h2 className="panel-title">{isFpna ? "Cycle dates" : "Cycle details"}</h2>
        {!isFpna && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
              <div className="text-[12px] text-muted">Status</div>
              <div className="mt-1"><span className={`badge ${cycle.status === "OPEN" ? "badge-healthy" : "badge-slate"}`}>{cycle.status === "OPEN" ? "Open" : "Stopped"}</span></div>
            </div>
            <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
              <div className="text-[12px] text-muted">Start date</div>
              <div className="mt-1 text-[12px] font-semibold text-ink">{dateLabel(cycle.startDate)}</div>
            </div>
            <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
              <div className="text-[12px] text-muted">End date</div>
              <div className="mt-1 text-[12px] font-semibold text-ink">{dateLabel(cycle.endDate)}</div>
            </div>
            <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
              <div className="text-[12px] text-muted">Evaluation date</div>
              <div className="mt-1 text-[12px] font-semibold text-ink">{dateLabel(cycle.evaluationDate)}</div>
            </div>
          </div>
        )}
        {canManageCycle && (
          <div className={`${isFpna ? "mt-3" : "mt-4 border-t border-line pt-4"}`}>
            {!isFpna && <h3 className="text-[13px] font-semibold text-ink">Cycle settings</h3>}
            <div className={isFpna ? "" : "mt-3"}>
              <CycleSettingsForm
                cycleId={cycle.id}
                startDate={cycle.startDate ?? null}
                endDate={cycle.endDate ?? null}
                status={cycle.status}
                showStatus={!isFpna}
              />
            </div>
          </div>
        )}
      </div>

      {!hideAnalytics && (
        <>
          <div className="card p-4">
            <h2 className="panel-title">Status breakdown</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {STATUSES.map((status) => {
                const count = all.byStatus.find((entry) => entry.code === status.code)?.count ?? 0;
                return (
                  <Link
                    key={status.code}
                    href={`/cranes?status=${status.code}`}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${count ? "border-line bg-panel-2 hover:border-brand" : "border-dashed border-line opacity-50"}`}
                  >
                    <StatusChip status={status.code} compact />
                    <span className="text-[12px] font-bold tabular-nums text-ink">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="panel-title">Cranes in this cycle</h2>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line bg-panel-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
                    <th className="px-3 py-2.5">Equipment ID</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Layer</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {all.rows.map((crane) => (
                    <tr key={crane.id} className="text-[12px] hover:bg-panel-2">
                      <td className="px-3 py-2.5 font-semibold text-brand">{crane.equipmentId}</td>
                      <td className="px-3 py-2.5 text-muted">{crane.description}</td>
                      <td className="px-3 py-2.5"><StatusChip status={crane.status} /></td>
                      <td className="px-3 py-2.5 text-muted">{STATUS_MAP[crane.status].layer}</td>
                      <td className="px-3 py-2.5 text-muted">{STATUS_MAP[crane.status].type}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Link href={`/cranes/${crane.id}`} className="text-[12px] font-semibold text-brand hover:underline">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
