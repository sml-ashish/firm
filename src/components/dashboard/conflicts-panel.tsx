import Link from "next/link";
import { ArrowUpRight, CircleAlert, Clock3 } from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";
import { EmptyState } from "@/components/empty-state";
import type { Crane } from "@/lib/firm/types";

export function ConflictsPanel({ cranes }: { cranes: Crane[] }) {
  return (
    <SectionCard
      title="Conflicts & risks"
      description="Everything is paused until the named owner decides within 3 working days."
      actions={<Link href="/cranes?status=S14" className="text-[12px] font-semibold text-brand hover:underline">View all <ArrowUpRight size={12} className="inline" /></Link>}
    >
      {cranes.length === 0 ? (
        <EmptyState title="No open conflicts" description="No crane is paused waiting for a conflict decision." />
      ) : (
        <div className="space-y-3">
          {cranes.map((crane) => (
            <div key={crane.id} className="rounded-[8px] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/cranes/${crane.id}`} className="font-mono text-[13px] font-semibold text-brand hover:underline">{crane.equipmentId}</Link>
                <span className="badge badge-red"><CircleAlert size={11} /> S14 · Decision pending</span>
              </div>
              <p className="mt-1.5 text-[12px] font-medium text-ink">{crane.conflict?.title ?? "Competing claims"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><Clock3 size={12} /> 3-day decision window</span>
                <span>Owner: <strong className="font-semibold text-ink">{crane.conflict?.decidedBy ?? "Named approver"}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
