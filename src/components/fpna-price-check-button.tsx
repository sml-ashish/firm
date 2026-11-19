"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type SaleQuoteView = {
  buyer: string;
  market: string;
  value: number;
  date: string;
  fpnaValidated: boolean;
  validatedBy: string | null;
  validatedAt?: string | null;
};

type FpnaSaleCrane = {
  id: string;
  equipmentId: string;
  status: string;
  saleQuotes: SaleQuoteView[];
  selectedSaleQuoteIndex?: number | null;
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** FP&A's price validation step before management approves a sale. */
export function FpnaPriceCheckButton({ crane, role }: { crane: FpnaSaleCrane; role: string }) {
  const quote = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1] ?? null;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {quote?.fpnaValidated ? "Price checked" : "Price check"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Sale price validation · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                S10 · FP&A checks the price before CBO / MD approval.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {quote ? (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
              <div><span className="text-faint">Buyer:</span> <strong className="text-ink">{quote.buyer}</strong></div>
              <div className="mt-1"><span className="text-faint">Market:</span> {quote.market}</div>
              <div className="mt-1"><span className="text-faint">Quotation:</span> {inr(quote.value)}</div>
              <div className="mt-1"><span className="text-faint">Date:</span> {quote.date}</div>
              <div className="mt-2">
                <span className={`badge ${quote.fpnaValidated ? "badge-green" : "badge-amber"}`}>
                  {quote.fpnaValidated
                    ? `Validated by ${quote.validatedBy ?? "FP&A"}${quote.validatedAt ? ` · ${new Date(quote.validatedAt).toLocaleString()}` : ""}`
                    : "Not yet validated"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-muted">No quotation has been sent by SCM yet.</p>
          )}

          {quote && !quote.fpnaValidated && (
            <div className="mt-4 border-t border-line pt-4">
              <ActionForm
                craneId={crane.id}
                kind="VALIDATE_SALE_PRICE"
                label="Validate price"
                role={role}
                requireComment
                confirmTitle="Validate this sale price?"
                confirmBody={`You are confirming ${inr(quote.value)} for ${quote.buyer}. Management approval opens after validation.`}
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
