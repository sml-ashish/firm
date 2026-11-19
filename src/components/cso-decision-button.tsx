"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { conflictOptions } from "@/lib/firm/workflow";

type AwardView = {
  bu: string;
  reason: string;
  decidedBy: string;
  csoRequired?: boolean;
  strategyHeadApprovedBy?: string | null;
  csoApprovedBy?: string | null;
  approvedBy: string | null;
};

type CsoCrane = {
  id: string;
  equipmentId: string;
  status: string;
  yieldPct: number;
  award: AwardView | null;
  buQuotes: { bu: string; expectedYieldPct: number | null }[];
  claimBack: { customer: string; reason: string; team?: string } | null;
  conflict: { ruleId: string; title: string; reason: string | null } | null;
};

/** CSO's award / exception decisions, opened from the crane register. */
export function CsoDecisionButton({ crane, role }: { crane: CsoCrane; role: string }) {
  const awarded = crane.award;
  const quote = awarded ? crane.buQuotes.find((entry) => entry.bu === awarded.bu) : null;
  const lowYield = awarded?.csoRequired ??
    (!!quote?.expectedYieldPct && crane.yieldPct > 0 && quote.expectedYieldPct < crane.yieldPct);
  const headDone = !!awarded?.strategyHeadApprovedBy;
  const csoDone = !lowYield || !!awarded?.csoApprovedBy;

  const trigger = crane.status === "S06" ? "Review award" : "Review exception";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {trigger}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                CSO decision · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {crane.status === "S06"
                  ? "S06 · BU award approval (yield below expected rate)"
                  : crane.status === "S13"
                    ? "S13 · Claim-back approval"
                    : "S14 · Conflict decision"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {crane.status === "S06" && awarded && (
            <>
              <div className="mt-4 space-y-1 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div><span className="text-faint">Awarded to:</span> <strong className="text-ink">{awarded.bu}</strong></div>
                <div><span className="text-faint">Reason:</span> {awarded.reason}</div>
                <div><span className="text-faint">Decided by:</span> {awarded.decidedBy}</div>
                <div>
                  <span className="text-faint">Yield check:</span>{" "}
                  {quote?.expectedYieldPct ?? "—"}% quoted vs {crane.yieldPct}% expected
                  {lowYield && <span className="ml-1 font-semibold text-nrg-ink">· CSO sign-off required</span>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                <span className={`badge ${headDone ? "badge-green" : "badge-amber"}`}>
                  Strategy Head {headDone ? `approved · ${awarded.strategyHeadApprovedBy}` : "pending"}
                </span>
                <span className={`badge ${csoDone ? "badge-green" : "badge-amber"}`}>
                  CSO {csoDone ? (awarded.csoApprovedBy ? `approved · ${awarded.csoApprovedBy}` : "not required") : "pending"}
                </span>
              </div>

              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <p className="text-[12px] leading-relaxed text-muted">
                  Approve to record the CSO sign-off. The crane is reserved (S07) once both required approvals are in place. Reject sends the award back to bid evaluation (S05).
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    craneId={crane.id}
                    kind="APPROVE_AWARD"
                    label="Approve award"
                    role={role}
                    requireComment
                    confirmTitle="Approve this award?"
                    confirmBody="Your CSO sign-off is recorded. The crane moves to S07 once the Strategy Head has also approved."
                  />
                  <ActionForm
                    craneId={crane.id}
                    kind="REJECT_AWARD"
                    label="Reject award"
                    role={role}
                    tone="danger"
                    requireComment
                    confirmTitle="Reject this award?"
                    confirmBody="The award is cleared and the crane returns to bid evaluation (S05)."
                  />
                </div>
              </div>
            </>
          )}

          {crane.status === "S13" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div><span className="text-faint">Customer:</span> {crane.claimBack?.customer ?? "—"}</div>
                {crane.claimBack?.team && <div className="mt-1"><span className="text-faint">Team:</span> {crane.claimBack.team}</div>}
                <div className="mt-1"><span className="text-faint">Reason:</span> {crane.claimBack?.reason ?? "—"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionForm craneId={crane.id} kind="APPROVE_CLAIM" label="Approve claim-back" role={role} requireComment confirmTitle="Approve claim-back?" />
                <ActionForm craneId={crane.id} kind="REJECT_CLAIM" label="Reject claim-back" role={role} tone="danger" requireComment confirmTitle="Reject claim-back?" />
              </div>
            </div>
          )}

          {crane.status === "S14" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div><span className="text-faint">Conflict:</span> {crane.conflict?.title ?? "—"}</div>
                <div className="mt-1"><span className="text-faint">Details:</span> {crane.conflict?.reason ?? "—"}</div>
              </div>
              <ActionForm
                craneId={crane.id}
                kind="RESOLVE_CONFLICT"
                label="Resolve conflict"
                role={role}
                requireComment
                confirmTitle="Resolve this conflict?"
                extra={
                  <select name="decision" className="select h-9" aria-label="Winning option">
                    {conflictOptions(crane.conflict?.ruleId).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                }
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
