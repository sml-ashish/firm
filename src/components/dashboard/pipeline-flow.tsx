"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Table2 } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { SectionCard } from "@/components/dashboard/section-card";
import { STATUSES, STATUS_MAP, type StatusCode } from "@/lib/firm/workflow";

const STAGES: { name: string; codes: StatusCode[]; color: string }[] = [
  { name: "Intake", codes: ["S01", "S02", "S03"], color: "var(--nrg)" },
  { name: "Review", codes: ["S04", "S05", "S06", "S07"], color: "var(--brand)" },
  { name: "Marketing / Bids", codes: ["S08", "S09", "S12", "S15"], color: "var(--old)" },
  { name: "Approval", codes: ["S10", "S11", "S13", "S14"], color: "var(--warning)" },
  { name: "Completed", codes: ["S16", "S17", "S18", "S19", "S20"], color: "var(--healthy)" },
];

export function PipelineFlow({ counts }: { counts: { code: StatusCode; count: number }[] }) {
  const [tableView, setTableView] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const byCode = new Map(counts.map((entry) => [entry.code, entry.count]));
  const max = Math.max(1, ...counts.map((entry) => entry.count));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <SectionCard
      title="Pipeline flow"
      description="Twenty statuses grouped into five stages. Every bar links to the filtered register."
      actions={
        <button
          type="button"
          className="btn btn-secondary h-9"
          onClick={() => setTableView((value) => !value)}
          aria-pressed={tableView}
        >
          <Table2 size={13} /> {tableView ? "View as chart" : "View as table"}
        </button>
      }
    >
      {total === 0 ? (
        <p className="text-[13px] text-muted">No cranes in this cycle yet.</p>
      ) : tableView ? (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-line text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Layer</th><th className="py-2 pr-3">Type</th><th className="py-2">Cranes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STATUSES.map((status) => (
                <tr key={status.code} className="text-[12px]">
                  <td className="py-1.5 pr-3 font-mono text-muted">{status.code}</td>
                  <td className="py-1.5 pr-3"><StatusChip status={status.code} compact /></td>
                  <td className="py-1.5 pr-3 text-muted">{status.layer}</td>
                  <td className="py-1.5 pr-3 text-muted">{status.type}</td>
                  <td className="py-1.5 font-semibold tabular-nums text-ink">{byCode.get(status.code) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4" role="img" aria-label={STAGES.map((stage) => `${stage.name}: ${stage.codes.reduce((sum, code) => sum + (byCode.get(code) ?? 0), 0)} cranes`).join(", ")}>
          {STAGES.map((stage) => {
            const stageTotal = stage.codes.reduce((sum, code) => sum + (byCode.get(code) ?? 0), 0);
            return (
              <div key={stage.name}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-ink">{stage.name}</span>
                  <span className="font-medium text-muted tabular-nums">{stageTotal} cranes</span>
                </div>
                <div className="space-y-1.5">
                  {stage.codes.map((code) => {
                    const count = byCode.get(code) ?? 0;
                    return (
                      <Link
                        key={code}
                        href={`/cranes?status=${code}`}
                        className="group flex items-center gap-2 rounded-[6px] px-1 py-1 transition hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-brand"
                        title={`${code} ${STATUS_MAP[code].name} · ${STATUS_MAP[code].type} · ${count} cranes`}
                      >
                        <span className="w-[190px] shrink-0 truncate text-[12px] text-muted group-hover:text-ink">
                          <span className="font-mono font-semibold text-ink">{code}</span> {STATUS_MAP[code].name}
                        </span>
                        <span className="h-2 min-w-2 flex-1 overflow-hidden rounded-full bg-panel-3">
                          <span
                            className="block h-full rounded-full transition-[width] duration-200 ease-out"
                            style={{ width: `${(count / max) * 100}%`, background: stage.color }}
                          />
                        </span>
                        <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-ink">{count}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[12px] text-muted">
            {STAGES.map((stage) => (
              <span key={stage.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: stage.color }} aria-hidden />
                {stage.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAll((value) => !value)}
        className="mt-4 flex w-full items-center justify-between rounded-[6px] border border-line px-3 py-2 text-[12px] font-medium text-muted transition hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-brand"
        aria-expanded={showAll}
      >
        All 20 statuses <ChevronDown size={14} className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
      </button>
      {showAll && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="20-status heat grid">
          {STATUSES.map((status) => {
            const count = byCode.get(status.code) ?? 0;
            return (
              <Link
                key={status.code}
                href={`/cranes?status=${status.code}`}
                title={`${status.name} · ${count} cranes`}
                className="rounded-[6px] border border-line px-2 py-1.5 transition hover:border-brand focus-visible:ring-2 focus-visible:ring-brand"
                style={{ background: count ? `color-mix(in oklch, ${stageColor(status.code)} 14%, var(--panel))` : "var(--panel-2)" }}
              >
                <div className="font-mono text-[12px] font-bold text-ink">{status.code}</div>
                <div className="truncate text-[12px] text-muted">{status.name}</div>
                <div className="text-[12px] font-semibold tabular-nums text-ink">{count}</div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function stageColor(code: StatusCode): string {
  return STAGES.find((stage) => stage.codes.includes(code))?.color ?? "var(--brand)";
}
