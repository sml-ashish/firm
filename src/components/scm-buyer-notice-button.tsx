"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type NoticeCrane = {
  id: string;
  equipmentId: string;
  status: string;
  saleQuotes: { buyer: string; value: number }[];
  selectedSaleQuoteIndex?: number | null;
  claimBack: {
    customer: string;
    rentalSoDueAt?: string | null;
    reservationDueAt?: string | null;
  } | null;
  conflict: {
    ruleId: string;
    winner: string | null;
    buyerNotifiedAt?: string | null;
    buyerNotifiedBy?: string | null;
  } | null;
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** SCM closes the sale loop with the losing buyer after a rental wins a conflict. */
export function ScmBuyerNoticeButton({ crane, role }: { crane: NoticeCrane; role: string }) {
  const conflict = crane.conflict;
  const international = conflict?.ruleId === "SALE_VS_INTERNATIONAL" &&
    crane.status === "S07" && conflict.winner === "International";
  const domestic = conflict?.ruleId === "SALE_VS_DOMESTIC" &&
    crane.status === "S15" && conflict.winner === "Domestic";
  if ((!international && !domestic) || !conflict) {
    return <span className="text-[12px] text-faint">—</span>;
  }

  const quote = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1] ?? null;
  const notified = !!conflict.buyerNotifiedAt;
  const due = international
    ? crane.claimBack?.reservationDueAt ?? crane.claimBack?.rentalSoDueAt
    : crane.claimBack?.rentalSoDueAt;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {notified ? "Buyer notified" : "Notify buyer"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Sale buyer notice · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {international
                  ? "The international rental won the conflict. Sale approval is stopped and the crane is reserved for the BU (S07)."
                  : "The domestic rental won the conflict. Sale approval is stopped and the crane has left the sale flow (S15)."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">{quote?.buyer ?? "Sale buyer"}</span>
              {quote && <span className="tabular-nums text-muted">{inr(quote.value)}</span>}
            </div>
            <div className="mt-1.5 text-muted">
              Rental customer: <strong className="font-semibold text-ink">{crane.claimBack?.customer ?? "—"}</strong>
            </div>
            <div className="mt-1 text-muted">
              {international ? "BU reservation due by" : "Rental SO due by"}:{" "}
              <strong className="font-semibold text-ink">{due ?? "—"}</strong>
            </div>
            {notified ? (
              <span className="badge badge-green mt-2">
                Buyer notified · {conflict.buyerNotifiedBy} · {new Date(conflict.buyerNotifiedAt!).toLocaleString()}
              </span>
            ) : (
              <span className="badge badge-amber mt-2">Buyer notice pending</span>
            )}
          </div>

          {!notified ? (
            <div className="mt-4 border-t border-line pt-4">
              <ActionForm
                craneId={crane.id}
                kind="NOTIFY_SALE_BUYER"
                label="Confirm buyer notified"
                role={role}
                requireComment
                confirmTitle="Confirm the buyer was told?"
                confirmBody={international
                  ? `Record how ${quote?.buyer ?? "the buyer"} was told that the international rental won. The sale approval stays stopped while Strategy reserves the crane.`
                  : `Record how ${quote?.buyer ?? "the buyer"} was told that the domestic rental won. Sales can only record the rental SO after this.`}
              />
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-[12px] text-muted">
              {international
                ? `The sale quotation is held. If Strategy has not reserved and deployed the crane by ${due}, it returns to S09 and this quotation can be revived while still valid.`
                : `The sale quotation is held. If no rental SO is recorded by ${due}, the crane returns to S09 and this quotation can be revived while still valid.`}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
