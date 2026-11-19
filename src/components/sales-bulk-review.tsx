"use client";

import { createContext, useActionState, useContext, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import { bulkSalesReviewAction, type ActionState } from "@/app/actions/firm";
import { SalesReviewFields } from "@/components/sales-review-fields";

type Selection = {
  selected: string[];
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/** Wraps the crane table so Sales can select rows and apply one review to all of them. */
export function SalesBulkReviewProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
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
      {children}
      {enabled && <BulkReviewBar />}
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
      aria-label="Select all reviewable cranes"
      className="h-3.5 w-3.5 accent-[var(--brand)]"
    />
  );
}

/** Row checkbox — only S01 cranes can be reviewed. */
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
      aria-label={`Select ${craneId} for review`}
      className="h-3.5 w-3.5 accent-[var(--brand)] disabled:opacity-30"
    />
  );
}

function BulkReviewBar() {
  const ctx = useContext(SelectionContext)!;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(bulkSalesReviewAction, null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

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
      <div className="card mb-3 flex flex-wrap items-center gap-3 border-[color-mix(in_srgb,var(--brand)_35%,transparent)] px-4 py-2.5">
        <span className="text-[12px] font-semibold text-ink">
          {ctx.selected.length} crane{ctx.selected.length === 1 ? "" : "s"} selected
        </span>
        <button type="button" className="btn btn-primary h-9" onClick={() => setOpen(true)}>
          <ClipboardCheck size={14} /> Review selected
        </button>
        <button type="button" className="btn btn-ghost h-9" onClick={ctx.clear}>
          Clear selection
        </button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                  Sales review · {ctx.selected.length} crane{ctx.selected.length === 1 ? "" : "s"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-muted">
                  The same marketability, duration and remarks are applied to every selected crane. NRG/RG stays as classified at upload.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Close"><X size={16} /></button>
              </Dialog.Close>
            </div>

            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="craneIds" value={JSON.stringify(ctx.selected)} />
              <div>
                <span className="mb-1 block text-[12px] font-semibold text-ink">Marketability / duration</span>
                <div className="space-y-2">
                  <SalesReviewFields />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  Duration is required only when the crane is marketable.
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink">Remarks (optional)</span>
                <textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="input w-full py-2" placeholder="Shared outcome for the selected cranes" />
              </label>
              {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Dialog.Close asChild><button type="button" className="btn btn-secondary h-9">Cancel</button></Dialog.Close>
                <button type="submit" className="btn btn-primary h-9" disabled={pending}>
                  {pending ? "Submitting…" : `Review ${ctx.selected.length} crane${ctx.selected.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
