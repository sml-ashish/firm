"use client";

import { ActionForm } from "@/components/approval-actions";
import { buLabel } from "@/lib/firm/bu";
import type { Award, BuQuote, ClaimBack, Conflict } from "@/lib/firm/types";
import { conflictOptions } from "@/lib/firm/workflow";

/** Shared CBO/CSO voting panel for a DOMESTIC_VS_BU conflict. */
export function JointConflictPanel({ crane, role, compact = false }: {
  crane: {
    id: string;
    claimBack: ClaimBack | null;
    conflict: Conflict;
    buQuotes: BuQuote[];
    award: Award | null;
  };
  role: string;
  compact?: boolean;
}) {
  const { conflict } = crane;
  const options = conflictOptions(conflict.ruleId);
  const interested = crane.buQuotes.filter((quote) => quote.interested);
  const voteLabel = (vote: string | null | undefined) => options.find((o) => o.value === vote)?.label ?? "—";

  return (
    <div className={`space-y-3 ${compact ? "" : "mt-4 border-t border-line pt-4"}`}>
      <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
        <div className="font-semibold text-ink">Domestic claim vs international BU interest</div>
        <div className="mt-1 text-muted">
          Claim by Domestic Sales for <strong className="font-semibold text-ink">{crane.claimBack?.customer ?? "—"}</strong>.
          {" "}{interested.length} BU quote{interested.length === 1 ? "" : "s"}
          {crane.award ? ` · awarded to ${buLabel(crane.award.bu)}` : ""}.
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`badge ${conflict.cboVote ? "badge-brand" : "badge-amber"}`}>
            CBO: {voteLabel(conflict.cboVote)}
          </span>
          <span className={`badge ${conflict.csoVote ? "badge-brand" : "badge-amber"}`}>
            CSO: {voteLabel(conflict.csoVote)}
          </span>
          {conflict.escalatedToMd && <span className="badge badge-red">Escalated to MD / CEO tie-break</span>}
        </div>
      </div>

      <div className="rounded-lg border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-brand-soft p-3 text-[12px] text-brand-ink">
        <div className="font-semibold">Both approvals are needed</div>
        <div className="mt-1">
          Domestic wins → all BU quotes are closed, every BU is told, crane goes to S15 and Sales creates the rental SO (S17).
        </div>
        <div className="mt-1">
          International wins → domestic claim is rejected and the crane returns to {crane.claimBack?.originStatus === "S05" ? "S05" : "S07"} so Strategy continues the BU award.
        </div>
        <div className="mt-1">If CBO and CSO disagree, the MD makes the final call as CEO escalation.</div>
      </div>

      {!conflict.escalatedToMd && (
        <ActionForm
          craneId={crane.id}
          kind="RESOLVE_CONFLICT"
          label="Record vote"
          role={role}
          requireComment
          confirmTitle="Record your conflict vote?"
          confirmBody="Your vote is recorded. The decision is final only when CBO and CSO agree."
          extra={
            <select name="decision" className="select h-9 w-auto" aria-label="Winning option" defaultValue={options[0]?.value}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          }
        />
      )}
      {conflict.escalatedToMd && (
        <p className="text-[12px] text-muted">CBO and CSO disagreed. The MD now records the final CEO tie-break decision.</p>
      )}
    </div>
  );
}
