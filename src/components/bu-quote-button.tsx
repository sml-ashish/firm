"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { INTERNATIONAL_BUS, buLabel } from "@/lib/firm/bu";

type BuCrane = {
  id: string;
  equipmentId: string;
  status: string;
  buQuotes: { bu: string; interested: boolean; revisedAt: string }[];
};

/** International BU's quote submission, opened from the crane register. */
export function BuQuoteButton({
  crane,
  role,
  buCode,
}: {
  crane: BuCrane;
  role: string;
  buCode?: string | null;
}) {
  const ownQuotes = buCode ? crane.buQuotes.filter((quote) => quote.bu === buCode) : crane.buQuotes;
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {ownQuotes.length ? `Quote (${ownQuotes.length})` : "Submit quote"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                BU quote · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Indicative quote for international rental. You can revise until the BU window closes.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {ownQuotes.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Your quote on file</div>
              <ul className="mt-2 space-y-0.5 text-[12px] text-muted">
                {ownQuotes.map((quote) => (
                  <li key={quote.bu}>· {buLabel(quote.bu)} — {quote.interested ? "Interested" : "Not interested"} · {new Date(quote.revisedAt).toLocaleString()}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <ActionForm
              craneId={crane.id}
              kind="SUBMIT_BU_QUOTE"
              label="Submit / revise quote"
              role={role}
              onSuccess={() => setOpen(false)}
              extra={
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  {buCode ? (
                    <>
                      <div className="flex h-9 items-center rounded-lg border border-line bg-panel-2 px-3 text-[12px] text-muted">
                        Your BU: <strong className="ml-1 text-ink">{buLabel(buCode)}</strong>
                      </div>
                      <input type="hidden" name="bu" value={buCode} />
                    </>
                  ) : (
                    <select name="bu" required className="select h-9" aria-label="Your BU">
                      <option value="">Select your BU</option>
                      {INTERNATIONAL_BUS.map((bu) => <option key={bu} value={bu}>{buLabel(bu)}</option>)}
                    </select>
                  )}
                  <select name="interested" className="select h-9" aria-label="Interested">
                    <option value="true">Interested</option>
                    <option value="false">Not interested</option>
                  </select>
                  <input name="ratePerMonth" type="number" min="0" placeholder="Monthly rental rate" className="input h-9" aria-label="Monthly rental rate" />
                  <input name="durationMonths" type="number" min="0" placeholder="Rental duration (months)" className="input h-9" aria-label="Rental duration" />
                  <input name="expectedYieldPct" type="number" min="0" step="0.1" placeholder="Expected yield %" className="input h-9" aria-label="Expected yield percentage" />
                  <input name="earliestStart" type="date" className="input h-9" aria-label="Earliest start date" />
                  <input name="customer" placeholder="Customer" className="input h-9" aria-label="Customer" />
                  <input name="country" placeholder="Country" className="input h-9" aria-label="Country" />
                </div>
              }
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
