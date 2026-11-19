import Link from "next/link";
import { ArrowRight, CalendarClock, ShieldCheck } from "lucide-react";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import type { Cycle } from "@/lib/firm/types";

const STAGE_META = [
  { key: "Intake", codes: ["S01", "S02", "S03"], color: "var(--nrg)" },
  { key: "Review", codes: ["S04", "S05", "S06", "S07"], color: "var(--brand)" },
  { key: "Marketing/Bids", codes: ["S08", "S09", "S12", "S15"], color: "var(--old)" },
  { key: "Approval", codes: ["S10", "S11", "S13", "S14"], color: "var(--warning)" },
  { key: "Completed", codes: ["S16", "S17", "S18", "S19", "S20"], color: "var(--healthy)" },
] as const;

function CountdownRing({ days }: { days: number }) {
  const ring = Math.max(8, Math.min(100, 100 - Math.abs(days) * 8));
  return (
    <div className="flex items-center gap-2.5" title={`Evaluation date · ${days >= 0 ? `${days} days left` : `${Math.abs(days)} days ago`}`}>
      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${ring} 100`} />
      </svg>
      <div>
        <div className="text-[12px] uppercase tracking-[0.08em] text-muted">Evaluation</div>
        <div className="text-[13px] font-semibold text-ink tabular-nums">
          {days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : `${Math.abs(days)}d ago`}
        </div>
      </div>
    </div>
  );
}

export function HeroStrip({
  cycle,
  daysToEvaluation,
  healthScore,
  healthReason,
  byStatus,
  total,
}: {
  cycle: Cycle | null;
  daysToEvaluation: number | null;
  healthScore: number;
  healthReason: string;
  byStatus: { code: string; count: number }[];
  total: number;
}) {
  const counts = STAGE_META.map((stage) => ({
    ...stage,
    count: byStatus.filter((entry) => stage.codes.includes(entry.code as never))
      .reduce((sum, entry) => sum + entry.count, 0),
  }));

  return (
    <section className="card relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand opacity-[0.07] blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] uppercase tracking-[0.1em] text-muted">Current cycle</span>
            <span className="badge badge-healthy"><ShieldCheck size={12} /> Open</span>
          </div>
          <h2 className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {cycle?.name ?? "No cycle open"}
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            {cycle ? `Opened by ${cycle.openedBy}` : "Upload a fleet to open a cycle"} · <LiveIndicator />
          </p>
        </div>

        {daysToEvaluation !== null && <CountdownRing days={daysToEvaluation} />}

        <div className="min-w-[200px] rounded-[8px] border border-line bg-panel-2 px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] uppercase tracking-[0.08em] text-muted">Cycle health</span>
            <span className="font-display text-[22px] font-semibold text-ink tabular-nums">{healthScore}</span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">{healthReason}</p>
        </div>

        {cycle && (
          <Link href={`/cycles/${cycle.id}`} className="btn btn-secondary h-9">
            View cycle <ArrowRight size={13} />
          </Link>
        )}
      </div>

      <div className="relative mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><CalendarClock size={12} /> Stage progress</span>
          <span className="tabular-nums">{total} cranes in cycle</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel-3" role="img" aria-label={counts.map((c) => `${c.key}: ${c.count}`).join(", ")}>
          {counts.map((stage) => (
            <div
              key={stage.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: total ? `${(stage.count / total) * 100}%` : "0%", background: stage.color }}
              title={`${stage.key}: ${stage.count}`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {counts.map((stage) => (
            <span key={stage.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: stage.color }} aria-hidden />
              {stage.key} <strong className="font-semibold text-ink tabular-nums">{stage.count}</strong>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
