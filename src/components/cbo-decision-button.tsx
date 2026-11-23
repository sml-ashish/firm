"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { JointConflictPanel } from "@/components/joint-conflict-panel";
import type { Award, BuQuote, ClaimBack, Conflict, SaleQuote } from "@/lib/firm/types";
import { conflictOptions } from "@/lib/firm/workflow";

type CboCrane = {
  id: string;
  equipmentId: string;
  status: "S10" | "S13" | "S14";
  saleQuotes: SaleQuote[];
  selectedSaleQuoteIndex?: number | null;
  claimBack: ClaimBack | null;
  conflict: Conflict | null;
  award: Award | null;
  buQuotes: BuQuote[];
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const CBO_STATUSES = ["S13", "S14"];

/** CBO decisions — claim-backs and domestic conflicts. Sale approval belongs to MD. */
export function CboDecisionButton({ crane, role }: { crane: CboCrane; role: string }) {
  if (!CBO_STATUSES.includes(crane.status)) {
    return <span className="text-[12px] text-faint">—</span>;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          CBO decision
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                CBO decision · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {crane.status === "S13" && "Domestic rental claim-back awaiting a final call."}
                {crane.status === "S14" && (crane.conflict?.ruleId === "SALE_VS_DOMESTIC"
                  ? "Sale quotation vs domestic rental. Choose the winner; the sale window clock is paused until you decide."
                  : crane.conflict?.ruleId === "DOMESTIC_VS_BU"
                    ? "Joint CBO + CSO decision. Both votes must agree; a disagreement escalates to the MD (CEO)."
                    : "Conflict between rental, sale or international transfer.")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {crane.status === "S13" && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
              <div className="font-semibold text-ink">{crane.claimBack?.customer ?? "Claim-back"}</div>
              <div className="mt-1 text-muted">
                {crane.claimBack?.team ?? "Domestic Sales"} · {crane.claimBack?.durationMonths ?? "—"} months · {inr(crane.claimBack?.rate ?? 0)}/month
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <ActionForm
                  craneId={crane.id}
                  kind="APPROVE_CLAIM"
                  label="Approve claim-back"
                  role={role}
                  requireComment
                  confirmTitle="Approve claim-back?"
                  confirmBody="The crane moves to S15. An SO must be created within 15 days."
                />
                <ActionForm
                  craneId={crane.id}
                  kind="REJECT_CLAIM"
                  label="Reject claim-back"
                  tone="danger"
                  role={role}
                  requireComment
                  confirmTitle="Reject claim-back?"
                  confirmBody="The crane returns to the layer it was pulled from."
                />
              </div>
            </div>
          )}

          {crane.status === "S14" && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
              <div className="font-semibold text-ink">{crane.conflict?.title ?? "Conflict decision pending"}</div>
              <div className="mt-1 text-muted">{crane.conflict?.reason ?? "Choose the winning option and record the reason."}</div>
              {crane.conflict?.ruleId === "SALE_VS_DOMESTIC" && (
                <div className="mt-2 rounded border border-line bg-panel px-2.5 py-2 text-[11px] text-muted">
                  {(() => {
                    const quote = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1];
                    return quote
                      ? <>Sale offer: <strong className="font-semibold text-ink">{quote.buyer} · {inr(quote.value)}</strong> vs rental by <strong className="font-semibold text-ink">{crane.claimBack?.customer ?? "—"}</strong></>
                      : <>Rental by <strong className="font-semibold text-ink">{crane.claimBack?.customer ?? "—"}</strong> against a held sale quotation.</>;
                  })()}
                  <div className="mt-1">Rental wins → S15 (SCM tells the buyer, 15 days for the SO). Sale wins → claim rejected, back to S10 with a fresh clock.</div>
                </div>
              )}
              {crane.conflict?.ruleId === "DOMESTIC_VS_BU" ? (
                <JointConflictPanel
                  crane={{
                    id: crane.id, claimBack: crane.claimBack,
                    conflict: crane.conflict!, buQuotes: crane.buQuotes, award: crane.award,
                  }}
                  role={role}
                />
              ) : (
                <div className="mt-3 border-t border-line pt-3">
                  <ActionForm
                    craneId={crane.id}
                    kind="RESOLVE_CONFLICT"
                    label="Resolve conflict"
                    role={role}
                    requireComment
                    confirmTitle="Resolve this conflict?"
                    confirmBody={crane.conflict?.title ?? "Record the decision and the losing option."}
                    extra={
                      <select name="decision" className="select h-9 w-auto" aria-label="Winning option">
                        {conflictOptions(crane.conflict?.ruleId).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    }
                  />
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
