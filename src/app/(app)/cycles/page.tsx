import Link from "next/link";
import { CalendarRange, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCycles, getCranes } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
  const user = await requireUser();
  const [cycles, all] = await Promise.all([getCycles(), getCranes()]);
  const canUpload = user.role === "FPNA" || user.role === "GLOBAL_ADMIN";
  const hideAnalytics = user.role === "SALES" || user.role === "MAINTENANCE";

  return (
    <>
      <PageHeader
        eyebrow="FIRM cycle"
        title="Cycles"
        actions={canUpload ? <Link href="/import" className="btn btn-primary">Upload a new fleet</Link> : undefined}
      />
      {cycles.length === 0 ? (
        <EmptyState icon={<CalendarRange size={19} />} title="No cycles yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cycles.map((cycle) => {
            const cranes = all.rows.filter((crane) => crane.cycleId === cycle.id);
            const locked = cranes.filter((crane) => ["S16", "S17", "S18", "S19"].includes(crane.status)).length;
            return (
              <Link key={cycle.id} href={`/cycles/${cycle.id}`} className="card p-4 transition hover:border-brand hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-[15px] font-semibold text-ink">{cycle.name}</div>
                    <div className="mt-0.5 text-[12px] text-faint">{cycle.id} · opened {dateLabel(cycle.openedAt)}</div>
                  </div>
                  <span className={`badge ${cycle.status === "OPEN" ? "badge-healthy" : "badge-slate"}`}>{cycle.status === "OPEN" ? "Open" : "Stopped"}</span>
                </div>
                <div className={`mt-4 grid gap-2 text-center ${hideAnalytics ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {!hideAnalytics && (
                    <>
                      <div className="rounded-lg bg-panel-2 py-2">
                        <div className="text-[15px] font-semibold tabular-nums text-ink">{cranes.length}</div>
                        <div className="text-[12px] text-muted">Cranes</div>
                      </div>
                      <div className="rounded-lg bg-panel-2 py-2">
                        <div className="text-[15px] font-semibold tabular-nums text-ink">{locked}</div>
                        <div className="text-[12px] text-muted">Exited</div>
                      </div>
                    </>
                  )}
                  <div className="rounded-lg bg-panel-2 py-2">
                    <div className="text-[12px] font-semibold text-ink">{dateLabel(cycle.startDate)}</div>
                    <div className="text-[12px] text-muted">Start</div>
                  </div>
                  <div className="rounded-lg bg-panel-2 py-2">
                    <div className="text-[12px] font-semibold text-ink">{dateLabel(cycle.endDate)}</div>
                    <div className="text-[12px] text-muted">End</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
                  <span>Opened by {cycle.openedBy}</span>
                  <span className="flex items-center gap-1 font-semibold text-brand">View <ArrowRight size={12} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
