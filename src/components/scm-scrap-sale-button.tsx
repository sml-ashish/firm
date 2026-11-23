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
  rejectedBy?: string | null;
  rejectedAt?: string | null;
};

type ScmScrapCrane = {
  id: string;
  equipmentId: string;
  scrapQuotes: ScrapQuoteView[];
  selectedScrapQuoteIndex?: number | null;
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** SCM runs the scrap sale, after MD approval at S11 and FP&A price validation. */
export function ScmScrapSaleButton({ crane, role }: { crane: ScmScrapCrane; role: string }) {
  const selectedIndex = crane.selectedScrapQuoteIndex ?? -1;
  const selected = crane.scrapQuotes[selectedIndex] ?? null;
  const hasSelection = selectedIndex >= 0;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          Scrap sale
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Scrap sale · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Record scrap buyers, send one price to FP&A, then create the SAP scrap SO. All other quotations are rejected when one is sent.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {selected && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
              <div className="font-semibold text-ink">{selected.buyer} · {inr(selected.value)}</div>
              <span className={`badge mt-2 ${selected.fpnaValidated ? "badge-green" : "badge-amber"}`}>
                {selected.fpnaValidated
                  ? `FP&A price validated · ${selected.validatedBy ?? "FP&A"}`
                  : "Awaiting FP&A price validation"}
              </span>
              {selected.fpnaValidated && (
                <div className="mt-3 border-t border-line pt-3">
                  <ActionForm
                    craneId={crane.id}
                    kind="RECORD_SCRAP_SO"
                    label="Record scrap SO → S19"
                    role={role}
                    extra={
                      <div className="grid w-full gap-1 sm:grid-cols-3">
                        <input name="soNumber" required placeholder="SAP scrap SO no." className="input h-9" aria-label="Scrap SO number" />
                        <input name="soStart" type="date" className="input h-9" aria-label="Scrap start date" />
                        <input name="soEnd" type="date" className="input h-9" aria-label="Scrap end date" />
                      </div>
                    }
                    confirmTitle="Lock the crane as scrapped?"
                    confirmBody="The scrap sale SO will be recorded in SAP and the crane cannot be claimed back."
                  />
                </div>
              )}
            </div>
          )}

          {crane.scrapQuotes.some((quote) => !quote.rejectedBy) && (
            <div className="mt-4 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-panel-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                  <tr>
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Send</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {crane.scrapQuotes
                    .map((quote, index) => ({ quote, index }))
                    .filter(({ quote }) => !quote.rejectedBy)
                    .map(({ quote, index }) => (
                      <tr key={`${quote.buyer}-${index}`} className="transition hover:bg-panel-2">
                        <td className="px-3 py-2.5 font-medium text-ink">{quote.buyer}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{inr(quote.value)}</td>
                        <td className="px-3 py-2.5 text-muted">{quote.date}</td>
                        <td className="px-3 py-2.5 text-right">
                          {!hasSelection && (
                            <ActionForm
                              craneId={crane.id}
                              kind="SELECT_SCRAP_QUOTE"
                              label="Send to FP&A"
                              role={role}
                              extra={<input type="hidden" name="quoteIndex" value={index} />}
                              confirmTitle="Send this scrap quotation for price check?"
                              confirmBody={`${quote.buyer}'s quotation of ${inr(quote.value)} goes to FP&A for validation. All other scrap quotations will be rejected.`}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {!hasSelection ? (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Attach a scrap quotation</div>
              <ActionForm
                craneId={crane.id}
                kind="SUBMIT_SCRAP_QUOTE"
                label="Save scrap quotation"
                role={role}
                extra={
                  <div className="grid w-full gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Buyer
                      <input name="buyer" required placeholder="Scrap buyer" className="input h-9" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Scrap price (₹)
                      <input name="value" type="number" min="1" step="1" required placeholder="0" className="input h-9" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Quotation date
                      <input name="date" type="date" required className="input h-9" />
                    </label>
                  </div>
                }
              />
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-[12px] text-muted">
              The sale window for scrap quotations is closed. This quotation is with FP&A for price validation.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
