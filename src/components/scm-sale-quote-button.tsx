"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { saleQuoteStillValid } from "@/lib/firm/workflow";

type SaleQuoteView = {
  buyer: string;
  market: string;
  value: number;
  date: string;
  fpnaValidated: boolean;
  validatedBy: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
};

type ScmSaleCrane = {
  id: string;
  equipmentId: string;
  status: string;
  saleQuotes: SaleQuoteView[];
  selectedSaleQuoteIndex?: number | null;
};

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** SCM's sale bin: gather quotations and send the chosen one to FP&A for price validation. */
export function ScmSaleQuoteButton({ crane, role }: { crane: ScmSaleCrane; role: string }) {
  const selected = crane.selectedSaleQuoteIndex ?? -1;
  const selectedQuote = crane.saleQuotes[selected] ?? null;
  const atS10 = crane.status === "S10";
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {atS10 ? "Sent for check" : `Quotes (${crane.saleQuotes.length})`}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Sale quotations · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Domestic and international buyers in parallel. Pick one quotation to send to FP&A for price validation.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {atS10 && selectedQuote && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Sent for approval</div>
              <div className="mt-1 font-semibold text-ink">{selectedQuote.buyer} · {inr(selectedQuote.value)}</div>
              <div className="mt-1 text-muted">{selectedQuote.market} · {selectedQuote.date}</div>
              <span className={`badge mt-2 ${selectedQuote.fpnaValidated ? "badge-green" : "badge-amber"}`}>
                {selectedQuote.fpnaValidated ? `FP&A price validated · ${selectedQuote.validatedBy}` : "Awaiting FP&A price validation"}
              </span>
            </div>
          )}

          {!atS10 && selectedQuote && (
            <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-brand-soft p-3 text-[12px] text-brand-ink">
              <div className="font-semibold">{selectedQuote.buyer}'s quotation is held from the paused sale.</div>
              <div className="mt-1">
                {saleQuoteStillValid(selectedQuote.date)
                  ? `Dated ${selectedQuote.date} · still valid · send it again to revive the sale (FP&A will recheck the price).`
                  : `Dated ${selectedQuote.date} · no longer valid · attach a fresh quotation instead.`}
              </div>
            </div>
          )}

          {crane.saleQuotes.some((quote) => !quote.rejectedBy) && (
            <div className="mt-4 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-panel-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                  <tr>
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2">Market</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Send</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {crane.saleQuotes
                    .map((quote, index) => ({ quote, index }))
                    .filter(({ quote }) => !quote.rejectedBy)
                    .map(({ quote, index }) => (
                      <tr key={`${quote.buyer}-${index}`} className="transition hover:bg-panel-2">
                        <td className="px-3 py-2.5 font-medium text-ink">{quote.buyer}</td>
                        <td className="px-3 py-2.5 text-muted">{quote.market}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{inr(quote.value)}</td>
                        <td className="px-3 py-2.5 text-muted">{quote.date}</td>
                        <td className="px-3 py-2.5 text-right">
                          {!atS10 ? (
                            <ActionForm
                              craneId={crane.id}
                              kind="SELECT_SALE_QUOTE"
                              label="Send to FP&A → S10"
                              role={role}
                              disabled={!saleQuoteStillValid(quote.date)}
                              extra={<input type="hidden" name="quoteIndex" value={index} />}
                              confirmTitle="Send quotation for price check?"
                              confirmBody={`${quote.buyer}'s quotation of ${inr(quote.value)} will move the crane to S10 for FP&A price validation and management approval. All other quotations will be rejected.`}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {!atS10 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Attach a quotation</div>
              <ActionForm
                craneId={crane.id}
                kind="SUBMIT_SALE_QUOTE"
                label="Save quotation"
                role={role}
                onSuccess={() => setOpen(false)}
                extra={
                  <div className="grid w-full gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Buyer
                      <input name="buyer" required placeholder="Buyer name" className="input h-9" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Market
                      <select name="market" required className="select h-9">
                        <option value="">Select market</option>
                        <option value="Domestic">Domestic</option>
                        <option value="International">International</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                      Quotation value (₹)
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
          )}

          {!atS10 && (
            <div className="mt-4 border-t border-line pt-4">
              <ActionForm
                craneId={crane.id}
                kind="NO_BUYER_TO_SCRAP"
                label="No buyer → scrap approval (S11)"
                role={role}
                tone="secondary"
                confirmTitle="Send for scrap approval?"
                confirmBody="This closes the sale window and asks MD to decide on a scrap sale (S11)."
              />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
