"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { buLabel } from "@/lib/firm/bu";
import type { Award, BuQuote, ClaimBack, Conflict, SaleQuote } from "@/lib/firm/types";
import { conflictOptions } from "@/lib/firm/workflow";

type MdCrane = {
  id: string;
  equipmentId: string;
  status: string;
  saleQuotes: SaleQuote[];
  selectedSaleQuoteIndex?: number | null;
  claimBack: ClaimBack | null;
  conflict: Conflict | null;
  award: Award | null;
  buQuotes: BuQuote[];
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** MD's sale decision, plus the CEO tie-break when CBO and CSO disagree. */
export function MdDecisionButton({ crane, role }: { crane: MdCrane; role: string }) {
  const tieBreak = crane.status === "S14" &&
    crane.conflict?.ruleId === "DOMESTIC_VS_BU" && crane.conflict.escalatedToMd;
  if (!tieBreak && crane.status !== "S10") {
    return <span className="text-[12px] text-faint">—</span>;
  }

  const selected = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1] ?? null;
  const options = conflictOptions("DOMESTIC_VS_BU");
  const voteLabel = (vote: string | null | undefined) =>
    options.find((option) => option.value === vote)?.label ?? "—";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {tieBreak ? "CEO tie-break" : "MD decision"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                {tieBreak ? "CEO tie-break" : "MD decision"} · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {tieBreak
                  ? "CBO and CSO disagreed on the domestic claim. As CEO escalation, make the final call."
                  : "FP&A has validated the sale price. Record the SAP sale SO number to complete the sale."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {tieBreak && crane.conflict ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div className="font-semibold text-ink">Domestic claim vs international BU interest</div>
                <div className="mt-1 text-muted">
                  Claim by Domestic Sales for <strong className="font-semibold text-ink">{crane.claimBack?.customer ?? "—"}</strong>.
                  {" "}{crane.buQuotes.filter((quote) => quote.interested).length} interested BU quote(s)
                  {crane.award ? ` · awarded to ${buLabel(crane.award.bu)}` : ""}.
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`badge ${crane.conflict.cboVote ? "badge-brand" : "badge-amber"}`}>CBO: {voteLabel(crane.conflict.cboVote)}</span>
                  <span className={`badge ${crane.conflict.csoVote ? "badge-brand" : "badge-amber"}`}>CSO: {voteLabel(crane.conflict.csoVote)}</span>
                  <span className="badge badge-red">Escalated to MD / CEO</span>
                </div>
              </div>
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-brand-soft p-3 text-[12px] text-brand-ink">
                <div>Domestic wins → BU quotes close, all BUs told, crane to S15 for the rental SO (S17).</div>
                <div className="mt-1">International wins → domestic claim rejected, crane back to {crane.claimBack?.originStatus === "S05" ? "S05" : "S07"} for Strategy to continue the BU award.</div>
              </div>
              <ActionForm
                craneId={crane.id}
                kind="RESOLVE_CONFLICT"
                label="Record final decision"
                role={role}
                requireComment
                confirmTitle="Record the CEO tie-break?"
                confirmBody="Your decision is final. The crane is routed according to the winning side."
                extra={
                  <select name="decision" className="select h-9 w-auto" aria-label="Winning option">
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                {selected ? (
                  <>
                    <div className="font-semibold text-ink">{selected.buyer} · {inr(selected.value)}</div>
                    <div className="mt-1 text-muted">{selected.market} · {selected.date}</div>
                    <span className={`badge mt-2 ${selected.fpnaValidated ? "badge-green" : "badge-amber"}`}>
                      {selected.fpnaValidated
                        ? `FP&A price validated · ${selected.validatedBy ?? "FP&A"}`
                        : "Awaiting FP&A price validation"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">No quotation was sent for validation.</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <ActionForm
                  craneId={crane.id}
                  kind="APPROVE_SALE"
                  label="Approve sale"
                  role={role}
                  requireComment
                  confirmTitle="Approve the sale?"
                  confirmBody="A sale SO must be created in SAP; the crane will then be locked (S18)."
                  extra={
                    <input
                      name="soNumber"
                      placeholder="SAP sale SO no."
                      className="input h-9 w-[200px] font-mono"
                      aria-label="Sale SO number"
                    />
                  }
                />
                <ActionForm
                  craneId={crane.id}
                  kind="REJECT_SALE"
                  label="Reject sale"
                  tone="danger"
                  role={role}
                  requireComment
                  confirmTitle="Reject the sale?"
                  confirmBody="The crane returns to the sale list (S09)."
                />
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
