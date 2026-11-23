"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { MaintenanceReviewFields } from "@/components/maintenance-review-fields";
import { SalesReviewFields } from "@/components/sales-review-fields";

type ReviewCrane = {
  id: string;
  equipmentId: string;
  status: string;
  salesSubmitted: boolean;
  marketable?: "Marketable" | "Not marketable" | null;
  nrg?: boolean | null;
  expectedMonths?: number | null;
  maintenanceSubmitted: boolean;
  deployable?: boolean | null;
  reason?: string | null;
};

/** Row-level Review control for Sales / Maintenance on the crane register. */
export function CraneReviewButton({
  crane,
  role,
}: {
  crane: ReviewCrane;
  role: string;
}) {
  const isSales = role === "SALES";
  const submitted = isSales ? crane.salesSubmitted : crane.maintenanceSubmitted;
  if (crane.status !== "S01") return <span className="text-[12px] text-faint">—</span>;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          Review
          {submitted && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-healthy" aria-label="Submitted" />}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Review {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {isSales
                  ? "Sales check · marketability and NRG flag. Only non-marketable cranes move to Finance dedup."
                  : "Maintenance check · deployability flag"}
                {submitted ? " · already submitted (you can update it)" : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            {isSales ? (
              <ActionForm
                craneId={crane.id}
                kind="SUBMIT_SALES"
                label={submitted ? "Update sales check" : "Submit sales check"}
                role={role}
                extra={
                  <SalesReviewFields
                    marketable={crane.marketable}
                    expectedMonths={crane.expectedMonths}
                    nrg={crane.nrg}
                  />
                }
              />
            ) : (
              <ActionForm
                craneId={crane.id}
                kind="SUBMIT_MAINTENANCE"
                label={submitted ? "Update maintenance check" : "Submit maintenance check"}
                role={role}
                extra={
                  <MaintenanceReviewFields
                    deployable={crane.deployable}
                    reason={crane.reason}
                  />
                }
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
