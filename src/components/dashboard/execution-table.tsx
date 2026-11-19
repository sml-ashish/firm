import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";

export function ExecutionTable({
  rows,
}: {
  rows: { id: string; equipmentId: string; soNumber: string; soEnd: string; daysLeft: number }[];
}) {
  return (
    <SectionCard
      title="Execution allowed from"
      description="A live SO keeps the crane in the cycle. New SOs, deployment and handover wait for its end date."
      actions={<Link href="/cranes?type=Active" className="text-[12px] font-semibold text-brand hover:underline">View all <ArrowUpRight size={12} className="inline" /></Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No SO end dates" description="Upload a fleet with SO End Date values to see the execution rule here." />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-line text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">SO number</th>
                <th className="py-2 pr-3">End date</th>
                <th className="py-2">Time remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const pct = Math.max(4, Math.min(100, row.daysLeft <= 0 ? 100 : 100 - Math.min(100, row.daysLeft * 3)));
                return (
                  <tr key={row.id} className="text-[12px]">
                    <td className="py-2 pr-3">
                      <Link href={`/cranes/${row.id}`} className="font-mono font-semibold text-brand hover:underline">{row.equipmentId}</Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-muted">{row.soNumber || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-muted tabular-nums">{row.soEnd}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-3" role="img" aria-label={`${row.daysLeft} days remaining`}>
                          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[12px] text-muted tabular-nums">
                          {row.daysLeft > 0 ? `${row.daysLeft}d left` : "Executable"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
