"use client";

import { useActionState, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createCycleAction, type ActionState } from "@/app/actions/firm";

/** FP&A opens a cycle with explicit start/end dates before any fleet is uploaded. */
export function CreateCycleForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCycleAction, null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.ok);
      setOpen(false);
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-primary">
          <Plus size={14} /> Create cycle
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">Create a FIRM cycle</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Only FP&A opens cycles. Set the window now; fleets are uploaded into this cycle afterwards.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close"><X size={16} /></button>
            </Dialog.Close>
          </div>

          <form action={formAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink">Cycle name</span>
              <input name="name" required placeholder="e.g. FIRM Cycle 2026-11" className="input h-9" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink">Start date</span>
                <input name="startDate" type="date" required className="input h-9" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink">End date</span>
                <input name="endDate" type="date" required className="input h-9" />
              </label>
            </div>
            {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Dialog.Close asChild><button type="button" className="btn btn-secondary h-9">Cancel</button></Dialog.Close>
              <button type="submit" className="btn btn-primary h-9" disabled={pending}>
                {pending ? "Creating…" : "Create cycle"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
