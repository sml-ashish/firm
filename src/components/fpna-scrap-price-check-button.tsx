"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type ScrapQuoteView = {
  buyer: string;
  value: number;
  date: string;
  fpnaValidated: boolean;
  validatedBy: string | null;
  validatedAt?: string | null;
};

type FpnaScrapCrane = {
  id: string;
  equipmentId: string;
  scrapQuotes: ScrapQuoteView[];
  selectedScrapQuoteIndex?: number | null;
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** FP&A validates the scrap price before SCM creates the SAP scrap SO. */
export function FpnaScrapPriceCheckButton({ crane, role }: { crane: FpnaScrapCrane; role: string }) {
  const quote = crane.scrapQuotes[crane.selectedScrapQuoteIndex ?? -1] ?? null;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {quote?.fpnaValidated ? "Scrap price checked" : "Scrap price check"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Scrap price validation · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                S12 · FP&A checks the scrap price before the scrap SO is created.
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
              <div className="mt-1"><span className="text-faint">Scrap price:</span> {inr(quote.value)}</div>
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
            <p className="mt-4 text-[12px] text-muted">No scrap quotation has been sent by SCM yet.</p>
          )}

          {quote && !quote.fpnaValidated && (
            <div className="mt-4 border-t border-line pt-4">
              <ActionForm
                craneId={crane.id}
                kind="VALIDATE_SCRAP_PRICE"
                label="Validate scrap price"
                role={role}
                requireComment
                confirmTitle="Validate this scrap price?"
                confirmBody={`You are confirming ${inr(quote.value)} for ${quote.buyer}. SCM can then create the scrap SO.`}
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
