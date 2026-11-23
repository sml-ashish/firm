"use client";

import { createContext, useActionState, useContext, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  bulkMaintenanceReviewAction, bulkSalesReviewAction, bulkStrategyToMarketingAction,
  bulkScmToScrapAction,
  type ActionState,
} from "@/app/actions/firm";
import { MaintenanceReviewFields } from "@/components/maintenance-review-fields";
import { SalesReviewFields } from "@/components/sales-review-fields";

type Selection = {
  selected: string[];
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/** Wraps the crane table so a role can select rows and apply one bulk action to all of them. */
export function SalesBulkReviewProvider({
  children,
  enabled,
  role,
}: {
  children: React.ReactNode;
  enabled: boolean;
  role: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const value: Selection = {
    selected,
    toggle: (id) =>
      setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])),
    selectAll: (ids) =>
      setSelected((prev) =>
        ids.every((id) => prev.includes(id))
          ? prev.filter((id) => !ids.includes(id))
          : [...new Set([...prev, ...ids])],
      ),
    clear: () => setSelected([]),
  };

  return (
    <SelectionContext.Provider value={value}>
      <div className={enabled ? "pb-20" : undefined}>{children}</div>
      {enabled && <BulkReviewBar role={role} />}
    </SelectionContext.Provider>
  );
}

/** Header checkbox — selects every S01 crane currently shown. */
export function CraneSelectAll({ ids }: { ids: string[] }) {
  const ctx = useContext(SelectionContext);
  if (!ctx) return null;
  const allSelected = ids.length > 0 && ids.every((id) => ctx.selected.includes(id));
  return (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={() => ctx.selectAll(ids)}
      disabled={ids.length === 0}
      aria-label="Select all eligible cranes"
      className="h-3.5 w-3.5 accent-[var(--brand)]"
    />
  );
}

/** Row checkbox — the parent page decides which statuses are selectable. */
export function CraneSelectCheckbox({
  craneId,
  disabled,
}: {
  craneId: string;
  disabled: boolean;
}) {
  const ctx = useContext(SelectionContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.includes(craneId)}
      onChange={() => ctx.toggle(craneId)}
      disabled={disabled}
      aria-label={`Select ${craneId} for bulk action`}
      className="h-3.5 w-3.5 accent-[var(--brand)] disabled:opacity-30"
    />
  );
}

function BulkReviewBar({ role }: { role: string }) {
  const ctx = useContext(SelectionContext)!;
  const isSales = role === "SALES";
  const isStrategy = role === "STRATEGY";
  const isScm = role === "SCM";
  const action = isScm
    ? bulkScmToScrapAction
    : isStrategy ? bulkStrategyToMarketingAction
    : isSales ? bulkSalesReviewAction : bulkMaintenanceReviewAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const team = isScm ? "SCM" : isSales ? "Sales" : isStrategy ? "Strategy" : "Maintenance";

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.ok);
      ctx.clear();
      setOpen(false);
      setComment("");
    }
    if (state?.error) toast.error(state.error);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ctx.selected.length === 0) return null;

  return (
    <>
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-ink">
            {ctx.selected.length} crane{ctx.selected.length === 1 ? "" : "s"} selected
          </span>
          <span className="text-[12px] text-muted">
            {isScm
              ? "Close the sale window for every selected crane and send them for MD scrap approval (S11)."
              : isStrategy
              ? "Close the BU route for every selected crane and move them to Marketing catalogue (S08)."
              : `Apply one ${team.toLowerCase()} review to all selected cranes.`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-ghost h-9" onClick={ctx.clear}>
              Clear
            </button>
            <button type="button" className="btn btn-primary h-9" onClick={() => setOpen(true)}>
              <ClipboardCheck size={14} /> {isScm
                ? "Move selected cranes to scrap procedure"
                : isStrategy ? "Send selected cranes to Marketing catalogue" : "Review selected cranes"}
            </button>
          </div>
        </div>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                  {isScm
                    ? `Move to scrap procedure · ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"}`
                    : isStrategy
                    ? `Send to Marketing catalogue · ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"}`
                    : `${team} review · ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"}`}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-muted">
                  {isScm
                    ? "The sale window closes for these cranes. MD reviews the scrap sale request at S11; FP&A checks the price before SCM can record a scrap SO."
                    : isStrategy
                    ? "This closes the BU route for every selected crane and moves them to Marketing catalogue preparation (S08)."
                    : isSales
                      ? "The same marketability and duration are applied to every selected crane. Only non-marketable cranes move to Finance dedup; marketable cranes stay at S01. NRG/RG stays as classified at upload."
                      : "The same deployability decision and reason are applied to every selected crane. Only non-marketable cranes move to Finance dedup."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Close"><X size={16} /></button>
              </Dialog.Close>
            </div>

            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="craneIds" value={JSON.stringify(ctx.selected)} />
              {isStrategy ? (
                <p className="text-[12px] leading-relaxed text-muted">
                  {ctx.selected.length} crane{ctx.selected.length === 1 ? "" : "s"} will move to S08. Marketing will prepare the catalogue before SCM can quote a sale.
                </p>
              ) : isScm ? (
                <p className="text-[12px] leading-relaxed text-muted">
                  {ctx.selected.length} crane{ctx.selected.length === 1 ? "" : "s"} will move to S11 — Scrap Approval Pending. Any recorded sale quotations stay on the crane for reference.
                </p>
              ) : (
                <div>
                  <span className="mb-1 block text-[12px] font-semibold text-ink">
                    {isSales ? "Marketability / duration" : "Deployability"}
                  </span>
                  <div className="space-y-2">
                    {isSales ? <SalesReviewFields /> : <MaintenanceReviewFields />}
                  </div>
                  {isSales && (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Duration is required only when the crane is marketable.
                    </p>
                  )}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink">
                  {isScm ? "Reason for scrap (optional)" : isStrategy ? "Note (optional)" : isSales ? "Remarks (optional)" : "Additional note (optional)"}
                </span>
                <textarea
                  name="comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  className="input w-full py-2"
                  placeholder={isScm ? "Why no acceptable buyer was found" : isStrategy ? "Reason for closing the BU route" : "Shared outcome for the selected cranes"}
                />
              </label>
              {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Dialog.Close asChild><button type="button" className="btn btn-secondary h-9">Cancel</button></Dialog.Close>
                <button type="submit" className="btn btn-primary h-9" disabled={pending}>
                  {pending ? "Submitting…" : isScm
                    ? `Move ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"} to scrap`
                    : isStrategy
                    ? `Send ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"} to Marketing`
                    : `Review ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
