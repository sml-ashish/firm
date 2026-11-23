"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type ClaimCrane = {
  id: string;
  equipmentId: string;
  status: string;
  claimBack: { status: string; customer: string } | null;
  conflict: {
    status: string;
    ruleId?: string | null;
    winner?: string | null;
    buyerNotifiedAt?: string | null;
  } | null;
  deployable: boolean | null;
};

const ELIGIBLE = ["S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S12"];

/** Sales and Strategy raise claim-backs from the register, before any SAP SO exists. */
export function ClaimBackButton({ crane, role }: { crane: ClaimCrane; role: string }) {
  if (crane.status === "S15") {
    const needsBuyerNotice = crane.conflict?.ruleId === "SALE_VS_DOMESTIC" &&
      crane.conflict.winner === "Domestic" && !crane.conflict.buyerNotifiedAt;
    return (
      <div className="space-y-1.5">
        <ActionForm
          craneId={crane.id}
          kind="RECORD_RENTAL_SO"
          label="Record rental SO → S17"
          role={role}
          disabled={needsBuyerNotice}
          extra={
            <div className="grid w-full gap-1 sm:grid-cols-3">
              <input name="soNumber" required placeholder="SAP rental SO no." className="input h-9" aria-label="Rental SO number" />
              <input name="soStart" type="date" className="input h-9" aria-label="Rental start date" />
              <input name="soEnd" type="date" className="input h-9" aria-label="Rental end date" />
            </div>
          }
          confirmTitle="Record the domestic rental SO?"
          confirmBody="The crane will be locked in SAP (S17) and cannot be claimed back."
        />
        {needsBuyerNotice && (
          <p className="text-[11px] text-muted">SCM must confirm the sale buyer was told before the rental SO is recorded.</p>
        )}
      </div>
    );
  }

  const blocked = !ELIGIBLE.includes(crane.status) || !!crane.claimBack || !!crane.conflict;
  if (blocked || crane.deployable === false) {
    return <span className="text-[12px] text-faint">—</span>;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          Claim back
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Claim back · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Every claim needs a real customer, rate, duration and expected SO date. A sale quotation sent to FP&A at S10 opens the CBO/CSO conflict; a quotation only saved at S09 does not.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <ActionForm
              craneId={crane.id}
              kind="REQUEST_CLAIM_BACK"
              label="Submit claim-back"
              role={role}
              extra={
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Customer
                    <input name="customer" required placeholder="Customer name" className="input h-9" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Rental rate (₹/month)
                    <input name="rate" type="number" min="1" step="1" required placeholder="0" className="input h-9" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Duration (months)
                    <input name="durationMonths" type="number" min="1" step="1" required placeholder="0" className="input h-9" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Expected SO date
                    <input name="expectedSoDate" type="date" required className="input h-9" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-medium text-muted">Reason</span>
                    <textarea name="reason" required rows={3} placeholder="Why this crane should be recalled" className="input min-h-[72px] w-full py-2" />
                  </label>
                </div>
              }
              confirmTitle="Submit this claim-back?"
              confirmBody="If another deal is live, the crane will be paused at S14 for the required conflict decision. Otherwise it waits for approval at S13."
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
