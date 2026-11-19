"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Layers3, X } from "lucide-react";
import { finaliseAllAction, type ActionState } from "@/app/actions/firm";

export function FinanceBulkDedupeButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(finaliseAllAction, null);

  useEffect(() => {
    if (state?.ok) toast.success(state.ok);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-primary h-9" disabled={count === 0 || pending}>
          <Layers3 size={14} /> Deduplicate all S02 ({count})
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Deduplicate all S02 cranes
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {count} crane{count === 1 ? "" : "s"} in the open cycle will be finalised and routed using the same flag priority: Non-Deployable → Old Fleet → NRG → Not in FIRM.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink">Decision comment (mandatory)</span>
              <textarea
                name="comment"
                required
                rows={3}
                placeholder="Record the basis for this bulk finalisation"
                className="input min-h-[80px] w-full py-2"
              />
            </label>
            {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
            {state?.ok && <p className="text-[12px] font-medium text-healthy-ink" role="status">{state.ok}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-secondary">Cancel</button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Deduplicating…" : "Confirm deduplication"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
